import { NextResponse } from "next/server";

import { createBookingIntent } from "@/features/booking-intents/create";
import {
  clickToChatUrlWithText,
  resolveEffectiveMetaConfiguration,
} from "@/features/organizations/providers";
import { apiError, apiException } from "@/lib/api/response";

// Needs Node (createSupabaseAdminClient), matching whatsapp/webhook/[organizationId].
export const runtime = "nodejs";

type Context = { params: Promise<{ organizationId: string }> };

// Public, unauthenticated by design: an external booking website (outside
// this repo) redirects a customer's own browser here after they pick a salon,
// time and optional services/technician. This hands them off to WhatsApp with
// their selections already made. See docs/architecture/authorization.md.
export async function GET(request: Request, { params }: Context) {
  const { organizationId } = await params;
  let e164Digits: string | null = null;

  try {
    const configuration = await resolveEffectiveMetaConfiguration(organizationId);
    if (configuration?.readiness !== "enabled" || !configuration.e164Digits) {
      return apiError(
        "booking_intent_unavailable",
        "A current successful phone validation is required",
        404,
      );
    }
    e164Digits = configuration.e164Digits;

    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { messageText } = await createBookingIntent(organizationId, {
      salonId: query.salonId || null,
      startsAt: query.startsAt,
      serviceIds: query.serviceIds
        ? query.serviceIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      technicianRef: query.technicianRef || null,
      additionalRequest: query.additionalRequest || null,
    });
    return redirectNoStore(clickToChatUrlWithText(e164Digits, messageText));
  } catch (error) {
    // A working WhatsApp destination beats a JSON error the customer's
    // browser is showing them directly: send them to the bot anyway with a
    // language-neutral wave, and let the bot's own onboarding greet them.
    if (e164Digits) return redirectNoStore(clickToChatUrlWithText(e164Digits, "👋"));
    return apiException(error);
  }
}

function redirectNoStore(url: string) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
