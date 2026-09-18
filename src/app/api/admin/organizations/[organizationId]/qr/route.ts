import QRCode from "qrcode";

import {
  clickToChatUrl,
  resolveEffectiveMetaConfiguration,
} from "@/features/organizations/providers";
import { apiError, apiException } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const configuration = await resolveEffectiveMetaConfiguration(organizationId);
    if (configuration?.readiness !== "enabled" || !configuration.e164Digits) {
      return apiError("qr_unavailable", "A current successful phone validation is required", 404);
    }
    const svg = await QRCode.toString(clickToChatUrl(configuration.e164Digits), {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": 'inline; filename="whatsapp-qr.svg"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiException(error);
  }
}
