import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getConversationTimezone } from "@/features/conversation/datetime";

// Caller (process-event.ts) extracts/strips the code itself up front, via
// code.ts's extractIntentCode/stripIntentCode -- stripping has to happen
// before conversation history is saved, while claiming has to happen after
// the duplicate/replay check, so the two steps cannot be one call here.

// Attempts the exactly-once claim for a code already extracted from an
// inbound message, then seeds booking_drafts on success. Returns false for
// any code with no matching, unconsumed, unexpired intent (unknown, already
// used, or expired) -- the message then falls through to today's normal
// free-text handling.
export async function claimBookingIntentByCode(
  organizationId: string,
  conversationId: string,
  code: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // The exactly-once guarantee: this UPDATE only affects a row that is still
  // unconsumed and unexpired, and it can match at most one row (the code is
  // unique per organization), so a replayed event or a second send of the
  // same text claims nothing the second time.
  const claim = await supabase
    .from("booking_intents")
    .update({ consumed_at: nowIso, consumed_conversation_id: conversationId })
    .eq("organization_id", organizationId)
    .eq("code", code)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("*")
    .maybeSingle();
  if (claim.error) throw claim.error;
  const intent = claim.data;
  if (!intent) return false;

  await seedDraftFromIntent(supabase, organizationId, conversationId, {
    salonId: intent.salon_id,
    startsAt: intent.starts_at,
    serviceSelections: intent.service_selections,
    technicianRef: intent.technician_ref,
    additionalRequest: intent.additional_request,
  });

  return true;
}

async function seedDraftFromIntent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
  conversationId: string,
  intent: {
    salonId: string | null;
    startsAt: string;
    serviceSelections: unknown;
    technicianRef: string | null;
    additionalRequest: string | null;
  },
) {
  // Dropped rather than rejected: the intent may be minutes or hours old by
  // the time the customer sends the prefill, and a stale reference here would
  // otherwise only surface as a create_booking error later (tools.ts). A null
  // salonId (no active salons, or exactly one selected implicitly at intent
  // creation time) needs no lookup here.
  let salonId: string | null = null;
  if (intent.salonId) {
    const salon = await supabase
      .from("salons")
      .select("id")
      .eq("id", intent.salonId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (salon.error) throw salon.error;
    salonId = salon.data ? intent.salonId : null;
  }

  let technicianRef: string | null = null;
  if (intent.technicianRef && salonId) {
    const technician = await supabase
      .from("technicians")
      .select("salon_id,active")
      .eq("id", intent.technicianRef)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (technician.error) throw technician.error;
    if (technician.data && technician.data.salon_id === salonId && technician.data.active) {
      technicianRef = intent.technicianRef;
    }
  }

  const timezone = await getConversationTimezone(organizationId);
  const { error } = await supabase.from("booking_drafts").upsert(
    {
      organization_id: organizationId,
      conversation_id: conversationId,
      salon_id: salonId,
      starts_at: intent.startsAt,
      timezone,
      service_selections: intent.serviceSelections,
      technician_ref: technicianRef,
      additional_request: intent.additionalRequest,
      state: "collecting",
      origin: "external_site",
    },
    { onConflict: "conversation_id" },
  );
  if (error) throw error;
}
