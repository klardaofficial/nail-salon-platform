import "server-only";

import QRCode from "qrcode";

import { clickToChatUrlWithText } from "@/features/organizations/providers";
import { formatCheckinTag } from "./checkin-code";

// A short human-readable line accompanies the tag so a staff member scanning
// the code sees something meaningful in their WhatsApp compose box before
// sending -- the tag itself is what our webhook parses.
export function buildCheckinPrefillText(bookingId: string): string {
  return `Check in booking ${formatCheckinTag(bookingId)}`;
}

export function buildCheckinUrl(e164Digits: string, bookingId: string): string {
  return clickToChatUrlWithText(e164Digits, buildCheckinPrefillText(bookingId));
}

// PNG (not the admin route's SVG) because this goes straight to Meta as
// image bytes for a WhatsApp message, never through a browser.
export async function renderCheckinQrPng(url: string): Promise<Uint8Array> {
  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });
  return new Uint8Array(buffer);
}
