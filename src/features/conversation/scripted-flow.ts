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

// Same convention for the "Update booking" option offered when a customer
// already has an active booking (see process-event.ts's active_booking fast
// path) -- the existing booking's ID travels in the button ID itself.
const UPDATE_ACTION_PREFIX = "booking:update:";

export function formatUpdateAction(bookingId: string): string {
  return `${UPDATE_ACTION_PREFIX}${bookingId}`;
}

export function parseUpdateAction(interactiveId: string | null | undefined): string | null {
  if (!interactiveId || !interactiveId.startsWith(UPDATE_ACTION_PREFIX)) return null;
  const candidate = interactiveId.slice(UPDATE_ACTION_PREFIX.length);
  return z.uuid().safeParse(candidate).success ? candidate : null;
}

// The sibling "do nothing" option -- carries no ID since there is nothing to
// look up.
export const SKIP_ACTION = "booking:skip";

export type ConfirmBookingOutcome =
  | {
      outcome: "confirmed";
      bookingId: string;
      startsAt: string;
      salon?: string;
      services?: string;
      technician?: string;
    }
  | { outcome: "unavailable" }
  | { outcome: "active_booking"; bookingId: string; startsAt: string };

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
    if (error instanceof Error && error.message.includes("active_booking_exists")) {
      const active = await supabase
        .from("bookings")
        .select("id,local_time_label")
        .eq("organization_id", input.organizationId)
        .eq("contact_id", input.contactId)
        .eq("status", "confirmed")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active.error) throw active.error;
      if (!active.data) return { outcome: "unavailable" };
      return {
        outcome: "active_booking",
        bookingId: active.data.id,
        startsAt: active.data.local_time_label,
      };
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
  { outcome: "cancelled"; bookingId: string } | { outcome: "not_cancellable" };

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
        { name?: string } | { name?: string }[] | null;
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

export type CheckinBookingOutcome =
  | { outcome: "checked_in"; bookingId: string; customerName: string; startsAt: string }
  | { outcome: "already_checked_in"; bookingId: string }
  | { outcome: "not_authorized" }
  | { outcome: "not_found" }
  | { outcome: "not_checkinable" };

// Thin wrapper over checkin_organization_booking -- the RPC is the actual
// authorization choke point (staff scope from stored mappings, never the
// sender's text claim); this just shapes its jsonb result into a discriminated
// outcome for process-event.ts's check-in-tag fast path.
export async function checkinBookingByStaff(input: {
  organizationId: string;
  actorContactId: string;
  actorWaId: string;
  bookingId: string;
}): Promise<CheckinBookingOutcome> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("checkin_organization_booking", {
    p_organization_id: input.organizationId,
    p_booking_id: input.bookingId,
    p_actor_contact_id: input.actorContactId,
    p_actor_wa_id: input.actorWaId,
  });
  if (error) throw error;
  const result = data as {
    ok: boolean;
    reason?: string;
    alreadyCheckedIn?: boolean;
    bookingId?: string;
    customerName?: string;
    localTimeLabel?: string;
  };
  if (!result.ok) {
    if (result.reason === "not_authorized") return { outcome: "not_authorized" };
    if (result.reason === "not_found") return { outcome: "not_found" };
    return { outcome: "not_checkinable" };
  }
  if (result.alreadyCheckedIn) {
    return { outcome: "already_checked_in", bookingId: result.bookingId ?? input.bookingId };
  }
  return {
    outcome: "checked_in",
    bookingId: result.bookingId ?? input.bookingId,
    customerName: result.customerName ?? "",
    startsAt: result.localTimeLabel ?? "",
  };
}

export type RescheduleDraftOutcome =
  | { outcome: "updated"; bookingId: string; startsAt: string }
  | { outcome: "not_updatable" }
  | { outcome: "no_draft" };

// Deterministic "Update booking (keep ID)" path for the active-booking-limit
// offer: reachable from a button tap regardless of whether the original
// active_booking_exists reply came from the BOOK-07 hand-off or the AI, since
// a tap must behave identically either way. Applies the draft the customer
// was already filling in (seeded by claimBookingIntentByCode or the AI's
// save_booking_details tool) onto the existing booking ID via
// reschedule_organization_booking, so the booking's ID and reporting history
// are preserved rather than creating a second booking.
export async function rescheduleBookingFromDraft(input: {
  organizationId: string;
  contactId: string;
  conversationId: string;
  bookingId: string;
  transport?: "whatsapp" | "simulator";
  idempotencyKey: string;
}): Promise<RescheduleDraftOutcome> {
  const supabase = createSupabaseAdminClient();
  const [draft, before, settings] = await Promise.all([
    supabase
      .from("booking_drafts")
      .select("salon_id,starts_at,service_selections,technician_ref,additional_request,state")
      .eq("conversation_id", input.conversationId)
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("technician_ref,starts_at,salon:salons!bookings_organization_salon_fkey(name)")
      .eq("id", input.bookingId)
      .eq("contact_id", input.contactId)
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("platform_timezone")
      .eq("organization_id", input.organizationId)
      .single(),
  ]);
  if (draft.error) throw draft.error;
  if (before.error) throw before.error;
  if (settings.error) throw settings.error;
  if (!draft.data || draft.data.state !== "collecting" || !draft.data.starts_at) {
    return { outcome: "no_draft" };
  }
  if (!before.data) return { outcome: "not_updatable" };

  const start = new Date(draft.data.starts_at);
  if (start.getTime() <= Date.now()) return { outcome: "not_updatable" };

  const technician = draft.data.technician_ref
    ? await supabase
        .from("technicians")
        .select("id,display_name,wa_id")
        .eq("id", draft.data.technician_ref)
        .eq("organization_id", input.organizationId)
        .maybeSingle()
    : { data: null, error: null };
  if (technician.error) throw technician.error;

  const timezone = settings.data.platform_timezone;
  const localLabel = formatConversationTime(start, timezone);

  let rescheduled: boolean;
  try {
    const { data, error } = await supabase.rpc("reschedule_organization_booking", {
      p_organization_id: input.organizationId,
      p_booking_id: input.bookingId,
      p_contact_id: input.contactId,
      p_salon_id: draft.data.salon_id,
      p_starts_at: start.toISOString(),
      p_timezone_snapshot: timezone,
      p_local_time_label: localLabel,
      p_technician_ref: technician.data?.id ?? null,
      p_technician_name_snapshot: technician.data?.display_name ?? null,
      p_additional_request: draft.data.additional_request,
      p_services: draft.data.service_selections,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw error;
    rescheduled = Boolean(data);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("booking_time_must_be_in_future") ||
        error.message.includes("booking_timezone_changed") ||
        error.message.includes("salon_is_not_active"))
    ) {
      return { outcome: "not_updatable" };
    }
    throw error;
  }
  if (!rescheduled) return { outcome: "not_updatable" };

  await supabase
    .from("booking_drafts")
    .update({ state: "completed" })
    .eq("conversation_id", input.conversationId);

  const newTechnicianId = technician.data?.id ?? null;
  const oldTechnicianWaId =
    before.data.technician_ref && before.data.technician_ref !== newTechnicianId
      ? (
          await supabase
            .from("technicians")
            .select("wa_id")
            .eq("id", before.data.technician_ref)
            .eq("organization_id", input.organizationId)
            .maybeSingle()
        ).data?.wa_id
      : null;
  if (oldTechnicianWaId || technician.data?.wa_id) {
    const [contact, newSalon] = await Promise.all([
      supabase
        .from("contacts")
        .select("display_name,wa_id")
        .eq("id", input.contactId)
        .eq("organization_id", input.organizationId)
        .single(),
      draft.data.salon_id
        ? supabase
            .from("salons")
            .select("name")
            .eq("id", draft.data.salon_id)
            .eq("organization_id", input.organizationId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (contact.error) throw contact.error;
    if (newSalon.error) throw newSalon.error;
    const oldSalonRelation = before.data.salon as unknown as
      { name?: string } | { name?: string }[] | null;
    const oldSalonName =
      (Array.isArray(oldSalonRelation) ? oldSalonRelation[0]?.name : oldSalonRelation?.name) ??
      "[N/A]";
    const customer = contact.data.display_name || "[N/A]";
    if (oldTechnicianWaId) {
      await queueTechnicianBookingNotification({
        organizationId: input.organizationId,
        transport: input.transport,
        status: "cancelled",
        technicianWaId: oldTechnicianWaId,
        bodyParameters: [
          oldSalonName,
          customer,
          contact.data.wa_id,
          formatConversationTime(before.data.starts_at, timezone),
          input.bookingId,
        ],
        deduplicationKey: `booking:${input.bookingId}:technician:cancelled:update:${input.idempotencyKey}`,
      });
    }
    if (technician.data?.wa_id) {
      await queueTechnicianBookingNotification({
        organizationId: input.organizationId,
        transport: input.transport,
        status: "confirmed",
        technicianWaId: technician.data.wa_id,
        bodyParameters: [
          newSalon.data?.name ?? "[N/A]",
          customer,
          contact.data.wa_id,
          localLabel,
          input.bookingId,
        ],
        deduplicationKey: `booking:${input.bookingId}:technician:confirmed:update:${input.idempotencyKey}`,
      });
    }
  }

  return { outcome: "updated", bookingId: input.bookingId, startsAt: localLabel };
}
