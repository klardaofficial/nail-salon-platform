import "server-only";

import { normalizeLanguageCode } from "@/lib/bot/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { templateLanguageCode } from "@/features/conversation/notifications";
import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";

// Consecutive cron ticks overlap by this many minutes so a single missed
// tick (deploy, transient error) still delivers the reminder on the next
// pass. Safe because message_outbox's unique (organization_id,
// deduplication_key) plus queueWhatsAppMessage's ignoreDuplicates upsert
// makes redelivery inside the overlap a no-op.
const WINDOW_MINUTES = 10;

function related(value: unknown, key: string, fallback = "") {
  if (Array.isArray(value)) {
    return String((value[0] as Record<string, unknown> | undefined)?.[key] ?? fallback);
  }
  if (value && typeof value === "object") {
    return String((value as Record<string, unknown>)[key] ?? fallback);
  }
  return fallback;
}

// Independent of notifications.ts's recipientLocale: that helper is directly
// unit-tested in conversation.test.ts and only returns a locale, not a
// conversation id. Reminders need both (the conversation id so the reminder
// lands in the admin Inbox thread), so this queries once instead of calling
// recipientLocale and then querying conversations again for the id.
async function resolveConversationContext(input: {
  organizationId: string;
  waId: string;
  transport: "whatsapp" | "simulator";
}) {
  const supabase = createSupabaseAdminClient();
  const [conversation, settings] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,reply_locale,contact:contacts!conversations_organization_contact_fkey!inner(wa_id)")
      .eq("contact.wa_id", input.waId)
      .eq("organization_id", input.organizationId)
      .eq("channel", input.transport === "simulator" ? "whatsapp_simulator" : "whatsapp")
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("bot_locale")
      .eq("organization_id", input.organizationId)
      .single(),
  ]);
  if (conversation.error ?? settings.error) throw conversation.error ?? settings.error;
  return {
    conversationId: (conversation.data?.id as string | undefined) ?? null,
    locale: normalizeLanguageCode(conversation.data?.reply_locale ?? "") ?? settings.data.bot_locale,
  };
}

async function queueBookingReminder(input: {
  organizationId: string;
  bookingId: string;
  offsetMinutes: number;
  templateName: string;
  customerName: string;
  customerWaId: string;
  localTimeLabel: string;
  simulated: boolean;
}) {
  if (!input.customerWaId) return false;
  const transport: "whatsapp" | "simulator" = input.simulated ? "simulator" : "whatsapp";
  const { conversationId, locale } = await resolveConversationContext({
    organizationId: input.organizationId,
    waId: input.customerWaId,
    transport,
  });
  await queueWhatsAppMessage({
    organizationId: input.organizationId,
    conversationId,
    transport,
    recipientWaId: input.customerWaId,
    payload: {
      kind: "template",
      name: input.templateName,
      languageCode: templateLanguageCode(locale),
      // The 2 agreed positional variables, in order: {{1}} customer name,
      // {{2}} appointment time. Documented for admins in template-help.tsx.
      bodyParameters: [input.customerName, input.localTimeLabel],
    },
    // Keyed on the offset, not the rule row's id, so deleting and re-adding
    // the same offset can never re-send or double-send.
    deduplicationKey: `booking:${input.bookingId}:reminder:${input.offsetMinutes}`,
  });
  return true;
}

async function queueRemindersForOffset(input: {
  organizationId: string;
  offsetMinutes: number;
  templateName: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const dueBy = new Date(now + input.offsetMinutes * 60_000).toISOString();
  const dueFrom = new Date(now + (input.offsetMinutes - WINDOW_MINUTES) * 60_000).toISOString();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id,starts_at,local_time_label,simulated,customer:contacts!bookings_organization_contact_fkey(display_name,wa_id)",
    )
    .eq("organization_id", input.organizationId)
    .eq("status", "confirmed")
    .gte("starts_at", dueFrom)
    .lte("starts_at", dueBy);
  if (error) throw error;
  if (!bookings?.length) return 0;

  let queued = 0;
  for (const booking of bookings) {
    const sent = await queueBookingReminder({
      organizationId: input.organizationId,
      bookingId: booking.id,
      offsetMinutes: input.offsetMinutes,
      templateName: input.templateName,
      customerName:
        related(booking.customer, "display_name") ||
        related(booking.customer, "wa_id", "WhatsApp customer"),
      customerWaId: related(booking.customer, "wa_id"),
      localTimeLabel: booking.local_time_label,
      simulated: booking.simulated,
    });
    if (sent) queued += 1;
  }
  return queued;
}

// Called from the shared five-minute maintenance tick
// (recoverDurableOutboxes in src/inngest/functions.ts) rather than its own
// Inngest function, so the reminder scan never doubles the billed cron
// function-run count.
export async function queueDueBookingReminders() {
  const supabase = createSupabaseAdminClient();
  const { data: rules, error } = await supabase
    .from("booking_reminder_rules")
    .select("organization_id,offset_minutes");
  if (error) throw error;
  if (!rules?.length) return { organizations: 0, queued: 0 };

  const byOrganization = new Map<string, number[]>();
  for (const rule of rules) {
    const offsets = byOrganization.get(rule.organization_id) ?? [];
    offsets.push(rule.offset_minutes);
    byOrganization.set(rule.organization_id, offsets);
  }

  let queued = 0;
  for (const [organizationId, offsets] of byOrganization) {
    // No reminder template resolves at either level for this organization
    // -> send nothing, and skip the booking scan entirely.
    const configuration = await resolveEffectiveMetaConfiguration(organizationId);
    const templateName = configuration?.templates.reminder.name;
    if (!templateName) continue;
    for (const offsetMinutes of offsets) {
      queued += await queueRemindersForOffset({ organizationId, offsetMinutes, templateName });
    }
  }
  return { organizations: byOrganization.size, queued };
}
