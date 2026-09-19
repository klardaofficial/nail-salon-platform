import "server-only";

import { createNaturalReply } from "./respond";
import type { ConversationActor } from "./tools";
import { claimBookingIntentByCode } from "@/features/booking-intents/claim";
import { extractIntentCode, stripIntentCode } from "@/features/booking-intents/code";
import { queueInteractiveChoices, queueWhatsAppMessage } from "@/features/messaging/outbox";
import type {
  NormalizedWhatsAppEvent,
  OutboundWhatsAppPayload,
} from "@/integrations/whatsapp/types";
import { unavailableFallback } from "@/lib/bot/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizedMessageText(event: Extract<NormalizedWhatsAppEvent, { kind: "message" }>) {
  if (event.message.text) return event.message.text;
  return event.message.interactiveTitle ?? event.message.caption ?? "";
}

async function processStatus(
  organizationId: string,
  event: Extract<NormalizedWhatsAppEvent, { kind: "status" }>,
) {
  const state = ["failed", "deleted"].includes(event.status.value) ? "failed" : "sent";
  const { error } = await createSupabaseAdminClient()
    .from("message_outbox")
    .update({ state, failure_code: event.status.failureCode })
    .eq("provider_message_id", event.status.messageId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

export async function processWhatsAppInboxEvent(inboxEventId: string) {
  const supabase = createSupabaseAdminClient();
  const inboxResult = await supabase
    .from("whatsapp_inbox_events")
    .select("*")
    .eq("id", inboxEventId)
    .single();
  if (inboxResult.error) throw inboxResult.error;
  if (inboxResult.data.processed_at) {
    console.log("[whatsapp] inbox event already processed, skipping", { inboxEventId });
    return { duplicate: true };
  }
  const organizationId = inboxResult.data.organization_id;
  async function markProcessed() {
    const result = await supabase
      .from("whatsapp_inbox_events")
      .update({ processed_at: new Date().toISOString(), failure_code: null })
      .eq("id", inboxEventId);
    if (result.error) throw result.error;
  }
  const event = inboxResult.data.payload as NormalizedWhatsAppEvent;
  let messageSettings: { simulator_enabled: boolean; bot_locale: string } | null = null;
  if (event.kind === "message") {
    const { data, error } = await supabase
      .from("organization_settings")
      .select("simulator_enabled,bot_locale")
      .eq("organization_id", organizationId)
      .single();
    if (error) throw error;
    messageSettings = data;
    if (event.simulated && !data.simulator_enabled) {
      console.error("[whatsapp] simulator event received but simulator_enabled=false", {
        organizationId,
        inboxEventId,
      });
      throw new Error("simulator_disabled");
    }
  }

  if (event.kind === "status") {
    await processStatus(organizationId, event);
    await markProcessed();
    return { processed: "status" };
  }

  const contactValues: Record<string, unknown> = {
    organization_id: organizationId,
    wa_id: event.contactWaId,
    normalized_phone: `+${event.contactWaId}`,
    last_contact_at: event.occurredAt,
  };
  if (event.profileName) contactValues.display_name = event.profileName;
  const contactResult = await supabase
    .from("contacts")
    .upsert(contactValues, { onConflict: "organization_id,wa_id" })
    .select("id")
    .single();
  if (contactResult.error) throw contactResult.error;
  const contactId = contactResult.data.id;
  const transport = event.simulated ? "simulator" : "whatsapp";

  const conversationResult = await supabase
    .from("conversations")
    .upsert(
      {
        organization_id: organizationId,
        contact_id: contactId,
        channel: event.simulated ? "whatsapp_simulator" : "whatsapp",
        last_activity_at: event.occurredAt,
      },
      { onConflict: "organization_id,contact_id,channel" },
    )
    .select("id,reply_locale,reply_unavailable_text")
    .single();
  if (conversationResult.error) throw conversationResult.error;
  const conversationId = conversationResult.data.id;
  const replyTarget = {
    organizationId,
    transport,
    conversationId,
    recipientWaId: event.contactWaId,
    deduplicationKey: `conversation:${conversationId}:reply:${event.providerEventId}`,
  } as const;
  const locale = conversationResult.data.reply_locale ?? messageSettings!.bot_locale;
  const rawMessageText = normalizedMessageText(event);
  // Extracted here (before history is stored) so the code never lands in
  // conversation_messages or the admin inbox; actually claimed further below,
  // after the duplicate/replay early-return, so a retried event can't burn an
  // intent for nothing and a completed draft can't be resurrected.
  const intentCode = extractIntentCode(rawMessageText);
  const messageText = intentCode ? stripIntentCode(rawMessageText) : rawMessageText;
  const historyResult = await supabase
    .from("conversation_messages")
    .upsert(
      {
        organization_id: organizationId,
        conversation_id: conversationId,
        direction: "inbound",
        message_type: event.message.type,
        provider_message_id: event.providerEventId,
        text_content: messageText,
        media_id: event.message.mediaId,
        structured_content: {
          interactiveId: event.message.interactiveId,
          interactiveTitle: event.message.interactiveTitle,
          mimeType: event.message.mimeType,
        },
      },
      { onConflict: "organization_id,provider_message_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (historyResult.error) throw historyResult.error;
  if (!historyResult.data) {
    // Saving inbound history is not proof that an earlier attempt queued its reply.
    const existingReply = await supabase
      .from("message_outbox")
      .select("payload")
      .eq("deduplication_key", replyTarget.deduplicationKey)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (existingReply.error) throw existingReply.error;
    if (existingReply.data) {
      await queueWhatsAppMessage({
        ...replyTarget,
        payload: existingReply.data.payload as OutboundWhatsAppPayload,
      });
      await markProcessed();
      return { duplicate: true };
    }
  }

  if (intentCode) await claimBookingIntentByCode(organizationId, conversationId, intentCode);

  const [owners, technicians] = await Promise.all([
    supabase
      .from("business_owners")
      .select("business_id")
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .limit(1),
    supabase
      .from("technicians")
      .select("id")
      .eq("wa_id", event.contactWaId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (owners.error) throw owners.error;
  if (technicians.error) throw technicians.error;
  const businessResult = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId)
    .single();
  if (businessResult.error) throw businessResult.error;
  const recentMedia = event.message.mediaId
    ? { media_id: event.message.mediaId }
    : (
        await supabase
          .from("conversation_messages")
          .select("media_id")
          .eq("conversation_id", conversationId)
          .not("media_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
  const actor: ConversationActor = {
    organizationId,
    businessId: businessResult.data.id,
    transport,
    conversationId,
    contactId,
    waId: event.contactWaId,
    isOwner: Boolean(owners.data?.length),
    technicianIds: (technicians.data ?? []).map((technician) => technician.id),
    currentMediaId: recentMedia?.media_id ?? null,
    locale,
  };
  console.log("[whatsapp] calling createNaturalReply", { conversationId, transport, locale });
  const reply = await createNaturalReply(actor);
  console.log("[whatsapp] createNaturalReply result", {
    conversationId,
    hasReply: Boolean(reply),
    optionCount: reply?.options.length ?? 0,
    text: reply?.text,
  });
  const localeResult = await supabase
    .from("conversations")
    .update({
      reply_locale: reply?.locale ?? locale,
      ...(reply ? { reply_unavailable_text: reply.unavailableText } : {}),
    })
    .eq("id", conversationId);
  if (localeResult.error) throw localeResult.error;
  if (reply?.options.length) {
    await queueInteractiveChoices({
      ...replyTarget,
      body: reply.text,
      buttonLabel: reply.buttonLabel,
      sectionTitle: reply.sectionTitle,
      options: reply.options.map((option) => ({
        ...option,
        description: option.description ?? undefined,
      })),
    });
  } else {
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: {
        kind: "text",
        text: reply?.text ?? conversationResult.data.reply_unavailable_text ?? unavailableFallback,
      },
    });
  }
  console.log("[whatsapp] reply queued, marking inbox event processed", {
    conversationId,
    deduplicationKey: replyTarget.deduplicationKey,
  });
  await markProcessed();
  return { processed: "message" };
}
