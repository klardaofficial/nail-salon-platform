import "server-only";

import { z } from "zod";

// Carries the booking's own UUID -- no new secret is needed. Authorization
// comes entirely from verifying the *sender* against stored owner/technician
// mappings (see checkin_organization_booking); the customer already holds
// this UUID as their booking reference, so the QR exposes nothing new.
const CHECKIN_TAG_PATTERN = /\[CHECKIN-([0-9a-fA-F-]{36})\]/;

export function formatCheckinTag(bookingId: string): string {
  return `[CHECKIN-${bookingId}]`;
}

export function extractCheckinBookingId(text: string): string | null {
  const candidate = text.match(CHECKIN_TAG_PATTERN)?.[1] ?? null;
  if (!candidate) return null;
  return z.uuid().safeParse(candidate).success ? candidate : null;
}

export function stripCheckinTag(text: string): string {
  return text.replace(CHECKIN_TAG_PATTERN, "").trim();
}
