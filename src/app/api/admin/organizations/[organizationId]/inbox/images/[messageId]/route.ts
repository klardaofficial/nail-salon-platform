import { z } from "zod";

import { buildCheckinUrl, renderCheckinQrPng } from "@/features/bookings/checkin-qr";
import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";
import { downloadWhatsAppMedia } from "@/integrations/whatsapp/client";
import { apiError, apiException } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const messageIdSchema = z.string().regex(/^(inbound|outbound):[0-9a-f-]{36}$/i);
type Context = { params: Promise<{ organizationId: string; messageId: string }> };

function simulatorCheckinBookingId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const image = payload as {
    kind?: unknown;
    transport?: unknown;
    mediaId?: unknown;
    simulatorImage?: { kind?: unknown; bookingId?: unknown };
  };
  if (
    image.kind !== "image" ||
    image.transport !== "simulator" ||
    image.mediaId !== null ||
    image.simulatorImage?.kind !== "checkin_qr" ||
    typeof image.simulatorImage.bookingId !== "string"
  )
    return null;
  return image.simulatorImage.bookingId;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { organizationId, messageId: rawMessageId } = await context.params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const messageId = messageIdSchema.parse(rawMessageId);
    const { data: message, error } = await createSupabaseAdminClient()
      .from("admin_organization_whatsapp_messages")
      .select("message_type,media_id,payload")
      .eq("organization_id", organizationId)
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw error;
    if (!message || message.message_type !== "image")
      return apiError("not_found", "Image message was not found", 404);

    const configuration = await resolveEffectiveMetaConfiguration(organizationId);
    const bookingId = simulatorCheckinBookingId(message.payload);
    if (bookingId) {
      if (!configuration?.e164Digits)
        return apiError("qr_unavailable", "A salon phone number is required", 404);
      const png = await renderCheckinQrPng(buildCheckinUrl(configuration.e164Digits, bookingId));
      const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
      return imageResponse(body, "image/png");
    }
    if (!message.media_id || !configuration?.credentials)
      return apiError("image_unavailable", "Image media is unavailable", 404);
    const image = await downloadWhatsAppMedia(message.media_id, {
      phoneNumberId: configuration.phoneNumberId ?? "",
      accessToken: configuration.credentials.accessToken,
    });
    const body = image.bytes.buffer.slice(
      image.bytes.byteOffset,
      image.bytes.byteOffset + image.bytes.byteLength,
    ) as ArrayBuffer;
    if (!image.mimeType.toLowerCase().startsWith("image/"))
      return apiError("image_unavailable", "Image media is unavailable", 404);
    return imageResponse(body, image.mimeType);
  } catch (error) {
    return apiException(error);
  }
}

function imageResponse(body: ArrayBuffer, mimeType: string) {
  return new Response(body, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
