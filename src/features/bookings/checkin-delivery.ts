import "server-only";

import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";
import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { uploadWhatsAppMedia } from "@/integrations/whatsapp/client";
import { resolveStaticMessages } from "@/lib/bot/static-messages";
import { buildCheckinUrl, renderCheckinQrPng } from "./checkin-qr";

// Renders the check-in QR and uploads it to Meta, returning the media ID.
// Kept as its own step.run so a Graph API failure retries without
// re-touching queueWhatsAppMessage's dedup key.
export async function renderAndUploadCheckinQr(
  organizationId: string,
  bookingId: string,
): Promise<string> {
  const meta = await resolveEffectiveMetaConfiguration(organizationId);
  if (
    meta?.readiness !== "enabled" ||
    !meta.e164Digits ||
    !meta.credentials ||
    !meta.phoneNumberId
  ) {
    throw new Error("organization_whatsapp_not_ready");
  }
  const url = buildCheckinUrl(meta.e164Digits, bookingId);
  const png = await renderCheckinQrPng(url);
  return uploadWhatsAppMedia(
    png,
    "image/png",
    { phoneNumberId: meta.phoneNumberId, accessToken: meta.credentials.accessToken },
    "checkin-qr.png",
  );
}

// Caption is static localized copy, never AI-generated -- delivery of the
// check-in QR is a deterministic fast path, identical whether the org's bot
// is on or off.
export async function queueCheckinQrDelivery(input: {
  organizationId: string;
  bookingId: string;
  conversationId: string;
  recipientWaId: string;
  locale: string;
  mediaId: string;
}): Promise<void> {
  const caption = resolveStaticMessages(input.locale).checkinQrCaption;
  await queueWhatsAppMessage({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    recipientWaId: input.recipientWaId,
    payload: { kind: "image", mediaId: input.mediaId, caption },
    deduplicationKey: `booking:${input.bookingId}:checkin-qr`,
  });
}
