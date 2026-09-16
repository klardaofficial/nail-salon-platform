import "server-only";

import { createNaturalReply } from "./respond";
import type { ConversationActor } from "./tools";
import { queueInteractiveChoices, queueWhatsAppMessage } from "@/features/messaging/outbox";
import type { NormalizedWhatsAppEvent } from "@/integrations/whatsapp/types";
import { getBotLocale, isWhatsAppSimulatorEnabled } from "@/lib/config/env";
import { getBotMessages } from "@/lib/bot/i18n";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizedMessageText(event: Extract<NormalizedWhatsAppEvent, { kind: "message" }>) {
  if (event.message.text) return event.message.text;
  if (event.message.interactiveId?.startsWith("salon:")) {
    return `I choose salon ID ${event.message.interactiveId.slice(6)}.`;
  }
  if (event.message.interactiveId === "intent:book") return "I want to book an appointment.";
  if (event.message.interactiveId === "intent:style")
    return "I want to try a nail style with my photo.";
  if (event.message.interactiveId) return `I selected ${event.message.interactiveId}.`;
  if (event.message.type === "image") {
    return event.message.caption
      ? `I sent a hand or nail photo. ${event.message.caption}`
      : "I sent a hand or nail photo and would like style advice.";
  }
  return "I sent a message type that may not be supported.";
}

function isSimpleGreeting(text: string) {
  return /^(hi|hello|hey|hallo|guten tag|guten morgen|moin)[!.,\s]*$/i.test(text);
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
    .select("id,greeted_at")
    .single();
  if (conversationResult.error) throw conversationResult.error;
  const conversationId = conversationResult.data.id;
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

  const [owners, technicians, salons] = await Promise.all([
    supabase.from("business_owners").select("business_id").eq("contact_id", contactId).limit(1),
    supabase
      .from("technicians")
      .select("id")
      .eq("wa_id", event.contactWaId)
      .eq("active", true)
      .is("deleted_at", null),
    supabase
      .from("salons")
      .select("id,name,location_label,timezone")
      .eq("active", true)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (owners.error) throw owners.error;
  if (technicians.error) throw technicians.error;
  if (salons.error) throw salons.error;

  const existingDraft = await supabase
    .from("booking_drafts")
    .select("id,salon_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (existingDraft.error) throw existingDraft.error;
  if (salons.data.length === 1 && !existingDraft.data?.salon_id) {
    if (existingDraft.data) {
      await supabase
        .from("booking_drafts")
        .update({ salon_id: salons.data[0].id })
        .eq("id", existingDraft.data.id);
    } else {
      await supabase
        .from("booking_drafts")
        .insert({ conversation_id: conversationId, salon_id: salons.data[0].id });
    }
  }

  let greetedNow = false;
  if (!conversationResult.data.greeted_at) {
    const greetingClaim = await supabase
      .from("conversations")
      .update({ greeted_at: new Date().toISOString() })
      .eq("id", conversationId)
      .is("greeted_at", null)
      .select("id")
      .maybeSingle();
    if (greetingClaim.error) throw greetingClaim.error;
    greetedNow = Boolean(greetingClaim.data);
  }

  const locale = getBotLocale();
  const messages = getBotMessages(locale);
  if (greetedNow) {
    const settings = await supabase
      .from("platform_settings")
      .select("greeting_en,greeting_de")
      .eq("singleton", true)
      .single();
    if (settings.error) throw settings.error;
    await queueWhatsAppMessage({
      transport,
      conversationId,
      recipientWaId: event.contactWaId,
      payload: {
        kind: "text",
        text:
          (locale === "de" ? settings.data.greeting_de : settings.data.greeting_en) ||
          messages.greetingFallback,
      },
      deduplicationKey: `conversation:${conversationId}:greeting`,
    });
  }

  if (!existingDraft.data?.salon_id && salons.data.length > 1) {
    await queueInteractiveChoices({
      transport,
      conversationId,
      recipientWaId: event.contactWaId,
      body: messages.chooseSalon,
      options: salons.data.slice(0, 10).map((salon) => ({
        id: `salon:${salon.id}`,
        title: salon.name,
        description: salon.location_label,
      })),
      deduplicationKey: `conversation:${conversationId}:salons:${event.providerEventId}`,
    });
  } else if (greetedNow) {
    await queueInteractiveChoices({
      transport,
      conversationId,
      recipientWaId: event.contactWaId,
      body: locale === "de" ? "Was möchtest du tun?" : "What would you like to do?",
      options: [
        { id: "intent:book", title: messages.book },
        { id: "intent:style", title: messages.tryStyle },
      ],
      deduplicationKey: `conversation:${conversationId}:welcome-actions`,
    });
  }

  if (!(greetedNow && isSimpleGreeting(messageText))) {
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
    };
    const reply = await createNaturalReply(actor);
    await queueWhatsAppMessage({
      transport,
      conversationId,
      recipientWaId: event.contactWaId,
      payload: { kind: "text", text: reply ?? messages.unavailable },
      deduplicationKey: `conversation:${conversationId}:reply:${event.providerEventId}`,
    });
  }

  await supabase
    .from("whatsapp_inbox_events")
    .update({ processed_at: new Date().toISOString(), failure_code: null })
    .eq("id", inboxEventId);
  return { processed: "message" };
}
