import { buildCheckinUrl, renderCheckinQrPng } from "@/features/bookings/checkin-qr";
import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";
import { isOrganizationSimulatorEnabled } from "@/features/simulator/service";
import { apiError, apiException } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ organizationId: string; outboxId: string }> };

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
    const { organizationId, outboxId } = await context.params;
    const guard = await requireOrganizationAdmin(organizationId);
    if (guard.error) return guard.error;
    if (!(await isOrganizationSimulatorEnabled(organizationId)))
      return apiError("not_found", "Simulator is disabled", 404);

    const { data: outbox, error } = await createSupabaseAdminClient()
      .from("message_outbox")
      .select("payload")
      .eq("id", outboxId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    const bookingId = simulatorCheckinBookingId(outbox?.payload);
    if (!bookingId) return apiError("not_found", "Simulator image was not found", 404);

    const configuration = await resolveEffectiveMetaConfiguration(organizationId);
    if (!configuration?.e164Digits)
      return apiError("qr_unavailable", "A salon phone number is required", 404);

    const png = await renderCheckinQrPng(buildCheckinUrl(configuration.e164Digits, bookingId));
    const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiException(error);
  }
}
