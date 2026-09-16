import "server-only";

import { createNaturalReply } from "./respond";
import type { ConversationActor } from "./tools";
import { queueInteractiveChoices, queueWhatsAppMessage } from "@/features/messaging/outbox";
import type { NormalizedWhatsAppEvent } from "@/integrations/whatsapp/types";
import { getBotLocale, isWhatsAppSimulatorEnabled } from "@/lib/config/env";
import { unavailableFallback } from "@/lib/bot/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizedMessageText(event: Extract<NormalizedWhatsAppEvent, { kind: "message" }>) {
  if (event.message.text) return event.message.text;
  return event.message.interactiveTitle ?? event.message.caption ?? "";
}

async function processStatus(event: Extract<NormalizedWhatsAppEvent, { kind: "status" }>) {
  const state = ["failed", "deleted"].includes(event.status.value) ? "failed" : "sent";
  const { error } = await createSupabaseAdminClient()
    .from("message_outbox")
    .update({ state, failure_code: event.status.failureCode })
    .eq("provider_message_id", event.status.messageId);
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
  if (inboxResult.data.processed_at) return { duplicate: true };
  const event = inboxResult.data.payload as NormalizedWhatsAppEvent;
  if (event.kind === "message" && event.simulated && !isWhatsAppSimulatorEnabled()) {
    throw new Error("simulator_disabled");
  }

  if (event.kind === "status") {
    await processStatus(event);
    await supabase
      .from("whatsapp_inbox_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", inboxEventId);
    return { processed: "status" };
  }

  const contactValues: Record<string, unknown> = {
    wa_id: event.contactWaId,
    normalized_phone: `+${event.contactWaId}`,
    last_contact_at: event.occurredAt,
  };
  if (event.profileName) contactValues.display_name = event.profileName;
  const contactResult = await supabase
    .from("contacts")
    .upsert(contactValues, { onConflict: "wa_id" })
    .select("id")
    .single();
  if (contactResult.error) throw contactResult.error;
  const contactId = contactResult.data.id;
  const transport = event.simulated ? "simulator" : "whatsapp";

  const conversationResult = await supabase
    .from("conversations")
    .upsert(
      {
        contact_id: contactId,
        channel: event.simulated ? "whatsapp_simulator" : "whatsapp",
        last_activity_at: event.occurredAt,
      },
      { onConflict: "contact_id,channel" },
    )
    .select("id,reply_locale,reply_unavailable_text")
    .single();
  if (conversationResult.error) throw conversationResult.error;
  const conversationId = conversationResult.data.id;
  const locale = conversationResult.data.reply_locale ?? getBotLocale();
  const messageText = normalizedMessageText(event);
  const historyResult = await supabase
    .from("conversation_messages")
    .upsert(
      {
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
      { onConflict: "provider_message_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (historyResult.error) throw historyResult.error;
  if (!historyResult.data) {
    await supabase
      .from("whatsapp_inbox_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", inboxEventId);
    return { duplicate: true };
  }

  const [owners, technicians] = await Promise.all([
    supabase.from("business_owners").select("business_id").eq("contact_id", contactId).limit(1),
    supabase
      .from("technicians")
      .select("id")
      .eq("wa_id", event.contactWaId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (owners.error) throw owners.error;
  if (technicians.error) throw technicians.error;
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
    transport,
    conversationId,
    contactId,
    waId: event.contactWaId,
    isOwner: Boolean(owners.data?.length),
    technicianIds: (technicians.data ?? []).map((technician) => technician.id),
    currentMediaId: recentMedia?.media_id ?? null,
    locale,
  };
  const reply = await createNaturalReply(actor);
  const replyTarget = {
    transport,
    conversationId,
    recipientWaId: event.contactWaId,
    deduplicationKey: `conversation:${conversationId}:reply:${event.providerEventId}`,
  } as const;
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
  const localeResult = await supabase
    .from("conversations")
    .update({
      reply_locale: reply?.locale ?? locale,
      ...(reply ? { reply_unavailable_text: reply.unavailableText } : {}),
    })
    .eq("id", conversationId);
  if (localeResult.error) throw localeResult.error;

  await supabase
    .from("whatsapp_inbox_events")
    .update({ processed_at: new Date().toISOString(), failure_code: null })
    .eq("id", inboxEventId);
  return { processed: "message" };
}
