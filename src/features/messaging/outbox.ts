import "server-only";

import { inngest } from "@/inngest/client";
import { sendWhatsAppMessage } from "@/integrations/whatsapp/client";
import { buildWhatsAppMessageBody } from "@/integrations/whatsapp/message-body";
import type { OutboundWhatsAppPayload } from "@/integrations/whatsapp/types";
import { getBotLocale } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function queueWhatsAppMessage(input: {
  conversationId?: string | null;
  recipientWaId: string;
  payload: OutboundWhatsAppPayload;
  deduplicationKey: string;
  transport?: "whatsapp" | "simulator";
}) {
  const supabase = createSupabaseAdminClient();
  const { data: inserted, error } = await supabase
    .from("message_outbox")
    .upsert(
      {
        conversation_id: input.conversationId ?? null,
        recipient_wa_id: input.recipientWaId,
        message_kind: input.payload.kind,
        payload: { ...input.payload, transport: input.transport ?? "whatsapp" },
        deduplication_key: input.deduplicationKey,
      },
      { onConflict: "deduplication_key", ignoreDuplicates: true },
    )
    .select("id,state")
    .maybeSingle();
  if (error) throw error;

  let outbox = inserted;
  if (!outbox) {
    const existing = await supabase
      .from("message_outbox")
      .select("id,state")
      .eq("deduplication_key", input.deduplicationKey)
      .single();
    if (existing.error) throw existing.error;
    outbox = existing.data;
  }

  if (outbox.state !== "sent") {
    await inngest.send({
      name: "whatsapp/message.queued",
      data: { outboxId: outbox.id },
    });
  }
  return outbox.id;
}

function historyText(payload: OutboundWhatsAppPayload) {
  if (payload.kind === "text") return payload.text;
  if (payload.kind === "image") return payload.caption ?? null;
  if (payload.kind === "template") return `Template: ${payload.name}`;
  return payload.body;
}

export async function deliverWhatsAppOutboxMessage(outboxId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: outbox, error } = await supabase
    .from("message_outbox")
    .select("*")
    .eq("id", outboxId)
    .single();
  if (error) throw error;
  if (outbox.state === "sent" && outbox.provider_message_id) return outbox.provider_message_id;

  const simulated = outbox.payload.transport === "simulator";
  const sending = await supabase
    .from("message_outbox")
    .update({
      state: "sending",
      attempt_count: outbox.attempt_count + 1,
      failure_code: null,
    })
    .eq("id", outbox.id);
  if (sending.error) throw sending.error;

  try {
    const payload = outbox.payload as OutboundWhatsAppPayload;
    // Exercise the same provider formatting/validation before capturing delivery.
    if (simulated) buildWhatsAppMessageBody(outbox.recipient_wa_id, payload);
    const providerMessageId = simulated
      ? `wamid.simulator.outbox.${outbox.id}`
      : await sendWhatsAppMessage(outbox.recipient_wa_id, payload);
    const { error: updateError } = await supabase
      .from("message_outbox")
      .update({
        state: "sent",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", outbox.id);
    if (updateError) throw updateError;

    if (outbox.conversation_id) {
      const { error: historyError } = await supabase.from("conversation_messages").upsert(
        {
          conversation_id: outbox.conversation_id,
          direction: "outbound",
          message_type: payload.kind,
          provider_message_id: providerMessageId,
          text_content: historyText(payload),
          media_id: payload.kind === "image" ? payload.mediaId : null,
          structured_content: payload,
        },
        { onConflict: "provider_message_id", ignoreDuplicates: true },
      );
      if (historyError) throw historyError;
    }
    return providerMessageId;
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "delivery_failed";
    await supabase
      .from("message_outbox")
      .update({ state: "failed", failure_code: code })
      .eq("id", outbox.id);
    throw error;
  }
}

export async function queueInteractiveChoices(input: {
  conversationId: string;
  recipientWaId: string;
  body: string;
  options: { id: string; title: string; description?: string }[];
  deduplicationKey: string;
  transport?: "whatsapp" | "simulator";
}) {
  const options = input.options.slice(0, 10);
  if (!options.length) return null;
  const payload: OutboundWhatsAppPayload =
    options.length <= 3
      ? { kind: "buttons", body: input.body, options }
      : {
          kind: "list",
          body: input.body,
          buttonLabel: getBotLocale() === "de" ? "Auswählen" : "Choose",
          sectionTitle: getBotLocale() === "de" ? "Optionen" : "Options",
          options,
        };
  return queueWhatsAppMessage({ ...input, payload });
}
