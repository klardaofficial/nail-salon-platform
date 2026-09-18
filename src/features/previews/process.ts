import "server-only";

import { toFile } from "openai";

import { summarizeImageUsage, withAIUsage } from "@/features/ai-usage/record";

import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { downloadWhatsAppMedia, uploadWhatsAppMedia } from "@/integrations/whatsapp/client";
import { getOpenAIClient } from "@/integrations/openai/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLocalizedText } from "@/features/conversation/localize";
import { unavailableFallback } from "@/lib/bot/language";
import { recipientLocale } from "@/features/conversation/notifications";
import {
  resolveEffectiveMetaConfiguration,
  resolveOpenAIConfiguration,
} from "@/features/organizations/providers";

export async function processStylePreview(organizationId: string, previewId: string) {
  const supabase = createSupabaseAdminClient();
  const previewResult = await supabase
    .from("preview_requests")
    .select("*,contact:contacts(wa_id)")
    .eq("organization_id", organizationId)
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
  const [meta, openAI] = await Promise.all([
    resolveEffectiveMetaConfiguration(preview.organization_id),
    resolveOpenAIConfiguration(preview.organization_id),
  ]);
  if (!meta?.credentials || !meta.phoneNumberId) throw new Error("organization_whatsapp_not_ready");
  if (!openAI) throw new Error("organization_openai_not_configured");
  const provider = {
    phoneNumberId: meta.phoneNumberId,
    accessToken: meta.credentials.accessToken,
  };

  const { error: stateError } = await supabase
    .from("preview_requests")
    .update({ state: "processing", failure_code: null })
    .eq("id", preview.id);
  if (stateError) throw stateError;

  const source = await downloadWhatsAppMedia(preview.source_media_id, provider);
  const sourceFile = await toFile(source.bytes, "customer-nails.jpg", { type: source.mimeType });
  const prompt = `Edit only the nails in this customer's hand or nail photo. Preserve the person's hand, skin, pose, lighting, background, and identity. Apply a realistic, salon-ready nail design matching this request: ${preview.style_request || "suggest a tasteful modern nail style"}. Produce distinct inspiration suitable for discussing with a nail technician.`;
  const model = openAI.imageModel;
  const result = await withAIUsage(
    {
      organizationId: preview.organization_id,
      conversationId: preview.conversation_id,
      previewRequestId: preview.id,
      channel: "whatsapp",
      kind: "image_generation",
      model,
      pricing: openAI.pricing,
    },
    () =>
      getOpenAIClient(openAI).images.edit({
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
      mediaIds.push(await uploadWhatsAppMedia(bytes, "image/jpeg", provider));
    } catch {
      // A partial result is still useful; remaining uploads continue.
    }
  }

  const { error: completeError } = await supabase.rpc("complete_preview_request", {
    p_organization_id: organizationId,
    p_request_id: preview.id,
    p_output_media_ids: mediaIds,
  });
  if (completeError) throw completeError;
  return mediaIds;
}

export async function queueStylePreviews(
  organizationId: string,
  previewId: string,
  mediaIds: string[],
) {
  const supabase = createSupabaseAdminClient();
  const previewResult = await supabase
    .from("preview_requests")
    .select("organization_id,conversation_id,contact:contacts(wa_id)")
    .eq("organization_id", organizationId)
    .eq("id", previewId)
    .single();
  if (previewResult.error) throw previewResult.error;
  const contact = previewResult.data.contact as { wa_id?: string } | { wa_id?: string }[] | null;
  const recipientWaId = Array.isArray(contact) ? contact[0]?.wa_id : contact?.wa_id;
  if (!recipientWaId) throw new Error("preview_recipient_missing");

  const locale = await recipientLocale(
    recipientWaId,
    "whatsapp",
    previewResult.data.organization_id,
  );
  for (const [index, mediaId] of mediaIds.entries()) {
    await queueWhatsAppMessage({
      organizationId: previewResult.data.organization_id,
      conversationId: previewResult.data.conversation_id,
      recipientWaId,
      payload: {
        kind: "image",
        mediaId,
        caption:
          (await createLocalizedText({
            organizationId: previewResult.data.organization_id,
            locale,
            conversationId: previewResult.data.conversation_id,
            task: "Caption this nail style preview, suggesting the customer show it to their nail professional for inspiration.",
            details: { previewNumber: index + 1 },
          })) ?? `✨ ${index + 1}`,
      },
      deduplicationKey: `preview:${previewId}:image:${index}`,
    });
  }
  if (!mediaIds.length) {
    await queueWhatsAppMessage({
      organizationId: previewResult.data.organization_id,
      conversationId: previewResult.data.conversation_id,
      recipientWaId,
      payload: {
        kind: "text",
        text:
          (await createLocalizedText({
            organizationId: previewResult.data.organization_id,
            locale,
            conversationId: previewResult.data.conversation_id,
            task: "Explain that the preview failed and ask the customer to resend the photo.",
            details: {},
          })) ?? unavailableFallback,
      },
      deduplicationKey: `preview:${previewId}:failed`,
    });
  }
  await supabase
    .from("preview_requests")
    .update({ state: mediaIds.length ? "delivered" : "failed" })
    .eq("organization_id", organizationId)
    .eq("id", previewId);
}
