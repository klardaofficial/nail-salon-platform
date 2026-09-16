import "server-only";

import { toFile } from "openai";

import { summarizeImageUsage, withAIUsage } from "@/features/ai-usage/record";

import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { downloadWhatsAppMedia, uploadWhatsAppMedia } from "@/integrations/whatsapp/client";
import { getOpenAIClient } from "@/integrations/openai/client";
import { getBotLocale, getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function processStylePreview(previewId: string) {
  const supabase = createSupabaseAdminClient();
  const previewResult = await supabase
    .from("preview_requests")
    .select("*,contact:contacts(wa_id)")
    .eq("id", previewId)
    .single();
  if (previewResult.error) throw previewResult.error;
  const preview = previewResult.data;
  const existingMediaIds = Array.isArray(preview.output_media_ids)
    ? preview.output_media_ids.map(String)
    : [];
  if (
    ["ready", "partially_ready", "delivered"].includes(preview.state) &&
    existingMediaIds.length
  ) {
    return existingMediaIds;
  }
  if (["failed", "released"].includes(preview.state)) return [];

  const { error: stateError } = await supabase
    .from("preview_requests")
    .update({ state: "processing", failure_code: null })
    .eq("id", preview.id);
  if (stateError) throw stateError;

  const source = await downloadWhatsAppMedia(preview.source_media_id);
  const sourceFile = await toFile(source.bytes, "customer-nails.jpg", { type: source.mimeType });
  const prompt = `Edit only the nails in this customer's hand or nail photo. Preserve the person's hand, skin, pose, lighting, background, and identity. Apply a realistic, salon-ready nail design matching this request: ${preview.style_request || "suggest a tasteful modern nail style"}. Produce distinct inspiration suitable for discussing with a nail technician.`;
  const model = getServerEnv().OPENAI_IMAGE_MODEL;
  const result = await withAIUsage(
    {
      conversationId: preview.conversation_id,
      previewRequestId: preview.id,
      channel: "whatsapp",
      kind: "image_generation",
      model,
    },
    () =>
      getOpenAIClient().images.edit({
        model,
        image: sourceFile,
        prompt,
        n: preview.requested_count,
        size: "1024x1024",
        quality: "low",
        output_format: "jpeg",
        input_fidelity: "high",
        user: preview.contact_id,
      }),
    summarizeImageUsage,
  );

  const mediaIds: string[] = [];
  for (const generated of result.data ?? []) {
    if (!generated.b64_json) continue;
    try {
      const bytes = new Uint8Array(Buffer.from(generated.b64_json, "base64"));
      mediaIds.push(await uploadWhatsAppMedia(bytes, "image/jpeg"));
    } catch {
      // A partial result is still useful; remaining uploads continue.
    }
  }

  const { error: completeError } = await supabase.rpc("complete_preview_request", {
    p_request_id: preview.id,
    p_output_media_ids: mediaIds,
  });
  if (completeError) throw completeError;
  return mediaIds;
}

export async function queueStylePreviews(previewId: string, mediaIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const previewResult = await supabase
    .from("preview_requests")
    .select("conversation_id,contact:contacts(wa_id)")
    .eq("id", previewId)
    .single();
  if (previewResult.error) throw previewResult.error;
  const contact = previewResult.data.contact as { wa_id?: string } | { wa_id?: string }[] | null;
  const recipientWaId = Array.isArray(contact) ? contact[0]?.wa_id : contact?.wa_id;
  if (!recipientWaId) throw new Error("preview_recipient_missing");

  const locale = getBotLocale();
  for (const [index, mediaId] of mediaIds.entries()) {
    await queueWhatsAppMessage({
      conversationId: previewResult.data.conversation_id,
      recipientWaId,
      payload: {
        kind: "image",
        mediaId,
        caption:
          locale === "de"
            ? `Style-Vorschau ${index + 1}. Zeig sie deinem Nail-Profi als Inspiration.`
            : `Style preview ${index + 1}. Show it to your nail professional as inspiration.`,
      },
      deduplicationKey: `preview:${previewId}:image:${index}`,
    });
  }
  if (!mediaIds.length) {
    await queueWhatsAppMessage({
      conversationId: previewResult.data.conversation_id,
      recipientWaId,
      payload: {
        kind: "text",
        text:
          locale === "de"
            ? "Die Vorschau hat diesmal nicht geklappt. Bitte sende das Foto erneut."
            : "The preview did not work this time. Please send the photo again.",
      },
      deduplicationKey: `preview:${previewId}:failed`,
    });
  }
  await supabase
    .from("preview_requests")
    .update({ state: mediaIds.length ? "delivered" : "failed" })
    .eq("id", previewId);
}
