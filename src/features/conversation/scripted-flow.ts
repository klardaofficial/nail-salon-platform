import "server-only";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ClaimedBookingIntent } from "@/features/booking-intents/claim";
import { formatConversationTime } from "./datetime";
import { queueTechnicianBookingNotification } from "./notifications";

// Interactive button ID convention for the one-tap Cancel option added to a
// confirmation message (both AI-enabled and scripted mode): the booking ID
// travels in the ID itself, so a tap needs no lookup before cancelling.
// src/integrations/whatsapp/normalize.ts already captures button_reply.id
// verbatim as message.interactiveId, and button IDs may be 256 characters
// (src/integrations/whatsapp/message-body.ts), well over a UUID's length.
const CANCEL_ACTION_PREFIX = "booking:cancel:";

export function formatCancelAction(bookingId: string): string {
  return `${CANCEL_ACTION_PREFIX}${bookingId}`;
}

export function parseCancelAction(interactiveId: string | null | undefined): string | null {
  if (!interactiveId || !interactiveId.startsWith(CANCEL_ACTION_PREFIX)) return null;
  const candidate = interactiveId.slice(CANCEL_ACTION_PREFIX.length);
  return z.uuid().safeParse(candidate).success ? candidate : null;
}

export type ConfirmBookingOutcome =
  | {
      outcome: "confirmed";
      bookingId: string;
      startsAt: string;
      salon?: string;
      services?: string;
      technician?: string;
    }
  | { outcome: "unavailable" };

// The scripted-mode counterpart of tools.ts:createBooking -- claimBookingIntentByCode
// only seeds booking_drafts; this is what actually turns the seeded draft into a real
// booking, using the RPC directly instead of going through the AI tool layer.
export async function confirmBookingFromIntent(input: {
  organizationId: string;
  businessId: string;
  contactId: string;
  conversationId: string;
  transport?: "whatsapp" | "simulator";
  claim: ClaimedBookingIntent;
}): Promise<ConfirmBookingOutcome> {
  const start = new Date(input.claim.startsAt);
  if (start.getTime() <= Date.now()) return { outcome: "unavailable" };

  const supabase = createSupabaseAdminClient();
  const [salon, technician, business] = await Promise.all([
    input.claim.salonId
      ? supabase
          .from("salons")
          .select("id,name")
          .eq("id", input.claim.salonId)
          .eq("organization_id", input.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.claim.technicianRef
      ? supabase
          .from("technicians")
          .select("id,display_name,wa_id")
          .eq("id", input.claim.technicianRef)
          .eq("organization_id", input.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("businesses")
      .select("id,active")
      .eq("id", input.businessId)
      .eq("organization_id", input.organizationId)
      .single(),
  ]);
  if (salon.error) throw salon.error;
  if (technician.error) throw technician.error;
  if (business.error) throw business.error;
  if (!business.data.active) return { outcome: "unavailable" };

  const localLabel = formatConversationTime(start, input.claim.timezone);
  const servicesLabel = Array.isArray(input.claim.serviceSelections)
    ? (input.claim.serviceSelections as Array<{ name?: string }>)
        .map((service) => service.name)
        .filter((name): name is string => Boolean(name))
        .join(", ")
    : undefined;

  let bookingId: string;
  try {
    const { data, error } = await supabase.rpc("create_organization_booking", {
      p_organization_id: input.organizationId,
      p_business_id: input.businessId,
      p_salon_id: salon.data?.id ?? null,
      p_contact_id: input.contactId,
      p_starts_at: start.toISOString(),
      p_timezone_snapshot: input.claim.timezone,
      p_local_time_label: localLabel,
      p_technician_ref: technician.data?.id ?? null,
      p_technician_name_snapshot: technician.data?.display_name ?? null,
      p_additional_request: input.claim.additionalRequest,
      p_idempotency_key: `intent:${input.claim.code}`,
      p_services: input.claim.serviceSelections,
      p_channel: input.transport === "simulator" ? "whatsapp_simulator" : "whatsapp",
    });
    if (error) throw error;
    bookingId = String(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes("booking_time_must_be_in_future")) {
      return { outcome: "unavailable" };
    }
    throw error;
  }

  await supabase
    .from("booking_drafts")
    .update({ state: "completed" })
    .eq("conversation_id", input.conversationId);

  if (technician.data?.wa_id) {
    const contact = await supabase
      .from("contacts")
      .select("display_name,wa_id")
      .eq("id", input.contactId)
      .eq("organization_id", input.organizationId)
      .single();
    if (contact.error) throw contact.error;
    await queueTechnicianBookingNotification({
      organizationId: input.organizationId,
      transport: input.transport,
      status: "confirmed",
      technicianWaId: technician.data.wa_id,
      bodyParameters: [
        salon.data?.name ?? "[N/A]",
        contact.data.display_name || "[N/A]",
        contact.data.wa_id,
        localLabel,
        bookingId,
      ],
      deduplicationKey: `booking:${bookingId}:technician:confirmed`,
    });
  }

  return {
    outcome: "confirmed",
    bookingId,
    startsAt: localLabel,
    ...(salon.data?.name ? { salon: salon.data.name } : {}),
    ...(servicesLabel ? { services: servicesLabel } : {}),
    ...(technician.data?.display_name ? { technician: technician.data.display_name } : {}),
  };
}

export type CancelBookingOutcome =
  | { outcome: "cancelled"; bookingId: string }
  | { outcome: "not_cancellable" };

// The scripted-mode counterpart of tools.ts:cancelBooking, reachable from a
// Cancel button tap without any AI involvement in either mode.
export async function cancelBookingForContact(input: {
  organizationId: string;
  contactId: string;
  bookingId: string;
  transport?: "whatsapp" | "simulator";
}): Promise<CancelBookingOutcome> {
  const supabase = createSupabaseAdminClient();
  const before = await supabase
    .from("bookings")
    .select("id,technician_ref,starts_at,salon:salons!bookings_organization_salon_fkey(name)")
    .eq("id", input.bookingId)
    .eq("contact_id", input.contactId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (before.error) throw before.error;
  if (!before.data) return { outcome: "not_cancellable" };

  const { data: cancelled, error } = await supabase.rpc("cancel_organization_booking", {
    p_organization_id: input.organizationId,
    p_booking_id: input.bookingId,
    p_contact_id: input.contactId,
    p_reason: null,
  });
  if (error) throw error;
  if (!cancelled) return { outcome: "not_cancellable" };

  if (before.data.technician_ref) {
    const technician = await supabase
      .from("technicians")
      .select("wa_id")
      .eq("id", before.data.technician_ref)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (technician.error) throw technician.error;
    if (technician.data?.wa_id) {
      const contact = await supabase
        .from("contacts")
        .select("display_name,wa_id")
        .eq("id", input.contactId)
        .eq("organization_id", input.organizationId)
        .single();
      if (contact.error) throw contact.error;
      const supabaseSettings = await supabase
        .from("organization_settings")
        .select("platform_timezone")
        .eq("organization_id", input.organizationId)
        .single();
      if (supabaseSettings.error) throw supabaseSettings.error;
      const salonRelation = before.data.salon as unknown as
        | { name?: string }
        | { name?: string }[]
        | null;
      const salonName =
        (Array.isArray(salonRelation) ? salonRelation[0]?.name : salonRelation?.name) ?? "[N/A]";
      await queueTechnicianBookingNotification({
        organizationId: input.organizationId,
        transport: input.transport,
        status: "cancelled",
        technicianWaId: technician.data.wa_id,
        bodyParameters: [
          salonName,
          contact.data.display_name || "[N/A]",
          contact.data.wa_id,
          formatConversationTime(before.data.starts_at, supabaseSettings.data.platform_timezone),
          input.bookingId,
        ],
        deduplicationKey: `booking:${input.bookingId}:technician:cancelled`,
      });
    }
  }

  return { outcome: "cancelled", bookingId: input.bookingId };
}
