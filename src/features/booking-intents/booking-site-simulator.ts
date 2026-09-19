import { fromZonedTime } from "date-fns-tz";

// Pure helpers for the admin "booking site simulator" -- a UI that stands in
// for an external booking website and calls the same public endpoints
// (docs/integrations/external-booking-website.md). Deliberately has no
// `server-only` import (unlike its sibling create.ts): a client component
// imports this module directly.

export type BookingSitePreviewValues = {
  startsAt: string;
  salonId: string | null;
  serviceIds: string[];
  technicianRef: string | null;
  additionalRequest: string | null;
};

// Mirrors the window.location.href snippet in
// docs/integrations/external-booking-website.md literally -- same parameter
// order, same encoding (raw commas between service IDs, not URLSearchParams'
// %2C) -- so the generated URL can be diffed against the guide.
export function buildBookingIntentPreviewUrl(
  bookingUrl: string,
  values: BookingSitePreviewValues,
): string {
  const additionalRequest = values.additionalRequest?.trim() ?? "";
  return (
    `${bookingUrl}?startsAt=${encodeURIComponent(values.startsAt)}` +
    (values.salonId ? `&salonId=${values.salonId}` : "") +
    (values.serviceIds.length ? `&serviceIds=${values.serviceIds.join(",")}` : "") +
    (values.technicianRef ? `&technicianRef=${values.technicianRef}` : "") +
    (additionalRequest ? `&additionalRequest=${encodeURIComponent(additionalRequest)}` : "")
  );
}

export type StartsAtIssue = "missing" | "unparseable" | "too_soon" | null;

// Mirrors createBookingIntent's own validation (create.ts) exactly, including
// the appended ":00" seconds and the "<=" lead-time comparison, using the same
// date-fns-tz function the server uses so client-side lead-time validation
// cannot drift from what the server actually enforces.
export function resolveStartsAtIssue(
  wallClock: string | null,
  timezone: string,
  minLeadTimeMinutes: number,
  now: number,
): StartsAtIssue {
  if (!wallClock) return "missing";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wallClock)) return "unparseable";
  const instant = fromZonedTime(`${wallClock}:00`, timezone);
  if (Number.isNaN(instant.getTime())) return "unparseable";
  return instant.getTime() <= now + minLeadTimeMinutes * 60_000 ? "too_soon" : null;
}

export type CatalogTotal = { total: number | null; missing: number };

// Never presents a partial sum as "the total" -- returns null whenever any
// value is null (or the list is empty), matching "Handling missing price and
// duration" in docs/integrations/external-booking-website.md. Call this
// independently for price and duration: one may be complete while the other
// is not.
export function catalogSum(values: (number | null)[]): CatalogTotal {
  const missing = values.filter((value) => value === null).length;
  if (missing > 0 || values.length === 0) return { total: null, missing };
  return { total: values.reduce<number>((sum, value) => sum + (value as number), 0), missing };
}

// Returns null for a null price, never "" -- forces the caller to choose a
// placeholder rather than accidentally rendering nothing. 0 correctly formats
// as e.g. "€0.00" (a genuinely free service, distinct from "not set").
export function formatCatalogPrice(
  price: number | null,
  currency: { symbol: string },
): string | null {
  return price === null ? null : `${currency.symbol}${price.toFixed(2)}`;
}

export function formatCatalogDuration(minutes: number | null): string | null {
  return minutes === null ? null : `${minutes} min`;
}

// service_salons: [] means "available at every salon" (see
// docs/architecture/data-model.md); a null salonId means there is nothing to
// filter by.
export function servicesForSalon<T extends { salonIds: string[] }>(
  services: T[],
  salonId: string | null,
): T[] {
  if (!salonId) return services;
  return services.filter(
    (service) => !service.salonIds.length || service.salonIds.includes(salonId),
  );
}

export function techniciansForSalon<T extends { salonId: string }>(
  technicians: T[],
  salonId: string | null,
): T[] {
  if (!salonId) return [];
  return technicians.filter((technician) => technician.salonId === salonId);
}

// "HH:mm" strings compare lexicographically. Advisory only -- see
// docs/integrations/external-booking-website.md: open hours are never
// enforced server-side.
export function isOutsideOpenHours(hhmm: string, openTime: string, closeTime: string): boolean {
  if (openTime >= closeTime) return false;
  return hhmm < openTime || hhmm > closeTime;
}
