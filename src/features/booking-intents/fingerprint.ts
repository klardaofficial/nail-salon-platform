import "server-only";

import { createHash } from "node:crypto";

export interface BookingIntentFingerprintInput {
  organizationId: string;
  salonId: string | null;
  startsAtIso: string;
  services: { serviceId: string | null; name: string }[];
  technicianRef: string | null;
  additionalRequest: string | null;
  locale: string;
}

// Deterministic dedup key for a booking-intent request. Sorted so that the
// same selections in a different order (e.g. service picker re-ordering)
// still collapse to the same fingerprint and reuse the cached message text.
export function fingerprintBookingIntent(input: BookingIntentFingerprintInput): string {
  const canonicalServices = [...input.services]
    .map((service) => ({ serviceId: service.serviceId, name: service.name.trim().toLowerCase() }))
    .sort((a, b) => {
      const key = (service: typeof a) => `${service.serviceId ?? ""}:${service.name}`;
      return key(a).localeCompare(key(b));
    });
  const payload = {
    organizationId: input.organizationId,
    salonId: input.salonId,
    startsAtIso: input.startsAtIso,
    services: canonicalServices,
    technicianRef: input.technicianRef,
    additionalRequest: input.additionalRequest?.trim() || null,
    locale: input.locale,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
