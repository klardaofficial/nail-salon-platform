import "server-only";

import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatConversationTime } from "@/features/conversation/datetime";
import { createLocalizedText } from "@/features/conversation/localize";
import { normalizeServiceSelections } from "@/features/conversation/tools";
import { formatIntentTag, generateIntentCode } from "./code";
import { fingerprintBookingIntent } from "./fingerprint";

// Exported so the public catalog endpoint's published `rules` cannot drift
// from what this schema actually enforces (see public-catalog.ts).
export const MAX_SERVICE_IDS = 20;
export const MAX_ADDITIONAL_REQUEST_LENGTH = 1000;

export const bookingIntentInputSchema = z.object({
  // Optional: omit when the organization has zero active salons (no salon to
  // record) or exactly one (selected implicitly). Required only to disambiguate
  // when more than one active salon exists -- see the salon resolution below.
  salonId: z.uuid().nullable().optional().default(null),
  // Naive local time, interpreted in the organization's platform_timezone.
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "startsAt must be YYYY-MM-DDTHH:mm"),
  serviceIds: z.array(z.uuid()).max(MAX_SERVICE_IDS).optional().default([]),
  technicianRef: z.uuid().nullable().optional().default(null),
  additionalRequest: z
    .string()
    .trim()
    .min(1)
    .max(MAX_ADDITIONAL_REQUEST_LENGTH)
    .nullable()
    .optional()
    .default(null),
});
export type BookingIntentInput = z.infer<typeof bookingIntentInputSchema>;

// Past this many AI-authored intents in the trailing hour, an organization's
// remaining intents this hour fall back to the deterministic template. Bounds
// unauthenticated OpenAI spend; see providers.ts resolveOpenAIConfiguration.
export const AI_MESSAGE_CAP_PER_HOUR = 20;
const AI_CAP_WINDOW_MS = 60 * 60 * 1000;
const INTENT_TTL_MS = 4 * 60 * 60 * 1000;
// Exported so the public catalog endpoint's published `rules` cannot drift
// from what createBookingIntent actually enforces (see public-catalog.ts).
export const MIN_LEAD_TIME_MS = 15 * 60 * 1000;

export class BookingIntentError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BookingIntentError";
  }
}

export interface BookingIntentResult {
  code: string;
  // The full wa.me prefill text: the [BK-...] tag followed by the message body.
  messageText: string;
  locale: string;
}

export async function createBookingIntent(
  organizationId: string,
  raw: unknown,
): Promise<BookingIntentResult> {
  const values = bookingIntentInputSchema.parse(raw);
  const supabase = createSupabaseAdminClient();

  const [salons, settings] = await Promise.all([
    supabase
      .from("salons")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null),
    supabase
      .from("organization_settings")
      .select("platform_timezone,bot_locale")
      .eq("organization_id", organizationId)
      .single(),
  ]);
  if (salons.error) throw salons.error;
  if (settings.error) throw settings.error;

  // Mirrors createBooking's own salon resolution (tools.ts): an explicit
  // salonId must match an active salon; otherwise a sole active salon is
  // implicit and zero active salons leaves salon null. Unlike createBooking
  // (where the AI asks the customer to pick when several salons are active),
  // there is no conversational turn here yet, so an omitted salonId with more
  // than one active salon is rejected rather than silently guessed.
  let salon: { id: string; name: string } | null = null;
  if (values.salonId) {
    salon = salons.data.find((item) => item.id === values.salonId) ?? null;
    if (!salon) throw new BookingIntentError("salon_is_not_active");
  } else if (salons.data.length === 1) {
    salon = salons.data[0];
  } else if (salons.data.length > 1) {
    throw new BookingIntentError("salon_selection_required");
  }

  const timezone = settings.data.platform_timezone;
  const locale = settings.data.bot_locale;

  const startsAtDate = fromZonedTime(`${values.startsAt}:00`, timezone);
  if (Number.isNaN(startsAtDate.getTime())) throw new BookingIntentError("invalid_starts_at");
  if (startsAtDate.getTime() <= Date.now() + MIN_LEAD_TIME_MS) {
    throw new BookingIntentError("booking_time_must_be_in_future");
  }

  // No salon means no technician either, mirroring createBooking (tools.ts).
  let technicianRef = salon ? values.technicianRef : null;
  let technicianName: string | null = null;
  if (technicianRef) {
    const technician = await supabase
      .from("technicians")
      .select("display_name,salon_id,active")
      .eq("id", technicianRef)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (technician.error) throw technician.error;
    // A technician outside this salon or no longer active is dropped rather
    // than rejecting the whole request, mirroring createBooking (tools.ts).
    if (technician.data && technician.data.salon_id === salon?.id && technician.data.active) {
      technicianName = technician.data.display_name;
    } else {
      technicianRef = null;
    }
  }

  // Only catalog service ids are accepted here (no free-text "Other" entries —
  // those only arise from conversational extraction). An id that does not
  // resolve to an active, salon-scoped service is silently dropped rather than
  // kept as a blank custom entry.
  const normalizedServices = await normalizeServiceSelections(
    organizationId,
    values.serviceIds.map((serviceId) => ({ serviceId, name: "" })),
    salon?.id ?? null,
  );
  const services = normalizedServices.filter((service) => service.serviceId !== null);

  const fingerprint = fingerprintBookingIntent({
    organizationId,
    salonId: salon?.id ?? null,
    startsAtIso: startsAtDate.toISOString(),
    services,
    technicianRef,
    additionalRequest: values.additionalRequest,
    locale,
  });

  const expiresAtIso = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  const reused = await reuseUnconsumedIntent(supabase, organizationId, fingerprint, expiresAtIso);
  if (reused) return reused;

  const localLabel = formatConversationTime(startsAtDate, timezone);
  const serviceNames = services.map((service) => service.name);
  const { text: messageBody, source: messageSource } = await buildMessageBody({
    organizationId,
    locale,
    salonName: salon?.name ?? null,
    localLabel,
    serviceNames,
    technicianName,
    additionalRequest: values.additionalRequest,
  });

  const code = generateIntentCode();
  const { data: inserted, error: insertError } = await supabase
    .from("booking_intents")
    .insert({
      organization_id: organizationId,
      code,
      salon_id: salon?.id ?? null,
      starts_at: startsAtDate.toISOString(),
      service_selections: services,
      technician_ref: technicianRef,
      additional_request: values.additionalRequest,
      locale,
      message_text: messageBody,
      message_source: messageSource,
      params_fingerprint: fingerprint,
      expires_at: expiresAtIso,
    })
    .select("code,message_text,locale")
    .single();

  if (insertError) {
    // Another concurrent request for the same params won the race between our
    // reuse lookup and this insert. The partial unique index
    // (organization_id, params_fingerprint) where consumed_at is null makes
    // this the only possible conflict; re-select its winner instead of
    // .upsert(), which cannot target a partial index (see
    // 202609180006_booking_intents_fingerprint_index.sql).
    if (insertError.code === "23505") {
      const reusedAfterConflict = await reuseUnconsumedIntent(
        supabase,
        organizationId,
        fingerprint,
        expiresAtIso,
      );
      if (reusedAfterConflict) return reusedAfterConflict;
    }
    throw insertError;
  }

  return {
    code: inserted.code,
    messageText: `${formatIntentTag(inserted.code)} ${inserted.message_text}`,
    locale: inserted.locale,
  };
}

async function reuseUnconsumedIntent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
  fingerprint: string,
  expiresAtIso: string,
): Promise<BookingIntentResult | null> {
  const existing = await supabase
    .from("booking_intents")
    .select("code,message_text,locale")
    .eq("organization_id", organizationId)
    .eq("params_fingerprint", fingerprint)
    .is("consumed_at", null)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) return null;

  const { error: extendError } = await supabase
    .from("booking_intents")
    .update({ expires_at: expiresAtIso })
    .eq("organization_id", organizationId)
    .eq("params_fingerprint", fingerprint)
    .is("consumed_at", null);
  if (extendError) throw extendError;

  return {
    code: existing.data.code,
    messageText: `${formatIntentTag(existing.data.code)} ${existing.data.message_text}`,
    locale: existing.data.locale,
  };
}

async function buildMessageBody(input: {
  organizationId: string;
  locale: string;
  salonName: string | null;
  localLabel: string;
  serviceNames: string[];
  technicianName: string | null;
  additionalRequest: string | null;
}): Promise<{ text: string; source: "ai" | "template" }> {
  const fallback = buildFallbackMessage(input);
  const oneHourAgoIso = new Date(Date.now() - AI_CAP_WINDOW_MS).toISOString();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("booking_intents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("message_source", "ai")
    .gt("created_at", oneHourAgoIso);
  if (error) throw error;
  if ((count ?? 0) >= AI_MESSAGE_CAP_PER_HOUR) return { text: fallback, source: "template" };

  const aiText = await createLocalizedText({
    organizationId: input.organizationId,
    locale: input.locale,
    task:
      "Write a booking request the customer is sending to the salon on WhatsApp, describing exactly " +
      "what they selected on the salon's booking website. Include every supplied detail. Do not greet " +
      "or sign off; this is the customer's own message, not a reply.",
    details: {
      salon: input.salonName ?? "[N/A]",
      appointment: input.localLabel,
      services: input.serviceNames.length ? input.serviceNames.join(", ") : "[N/A]",
      technician: input.technicianName ?? "[N/A]",
      note: input.additionalRequest ?? "[N/A]",
    },
  });
  return aiText ? { text: aiText, source: "ai" } : { text: fallback, source: "template" };
}

function buildFallbackMessage(input: {
  salonName: string | null;
  localLabel: string;
  serviceNames: string[];
  technicianName: string | null;
  additionalRequest: string | null;
}) {
  const parts = [
    input.salonName
      ? `I'd like to book at ${input.salonName} on ${input.localLabel}.`
      : `I'd like to book an appointment on ${input.localLabel}.`,
  ];
  if (input.serviceNames.length) parts.push(`Service(s): ${input.serviceNames.join(", ")}.`);
  if (input.technicianName) parts.push(`Technician: ${input.technicianName}.`);
  if (input.additionalRequest) parts.push(input.additionalRequest);
  return parts.join(" ");
}
