import { describe, expect, it } from "vitest";
import {
  buildBookingIntentPreviewUrl,
  catalogSum,
  resolveStartsAtIssue,
  servicesForSalon,
} from "./booking-site-simulator";

describe("buildBookingIntentPreviewUrl", () => {
  const bookingUrl = "https://example.com/api/public/org-1/booking-intent";

  it("omits salonId, serviceIds, technicianRef, and additionalRequest when unset", () => {
    const url = buildBookingIntentPreviewUrl(bookingUrl, {
      startsAt: "2026-09-20T15:00",
      salonId: null,
      serviceIds: [],
      technicianRef: null,
      additionalRequest: null,
    });
    expect(url).toBe(`${bookingUrl}?startsAt=2026-09-20T15%3A00`);
  });

  it("joins serviceIds with a raw comma, not URL-encoded", () => {
    const url = buildBookingIntentPreviewUrl(bookingUrl, {
      startsAt: "2026-09-20T15:00",
      salonId: null,
      serviceIds: ["svc-1", "svc-2"],
      technicianRef: null,
      additionalRequest: null,
    });
    expect(url).toContain("&serviceIds=svc-1,svc-2");
  });

  it("includes salonId and technicianRef verbatim when set", () => {
    const url = buildBookingIntentPreviewUrl(bookingUrl, {
      startsAt: "2026-09-20T15:00",
      salonId: "salon-1",
      serviceIds: [],
      technicianRef: "tech-1",
      additionalRequest: null,
    });
    expect(url).toContain("&salonId=salon-1");
    expect(url).toContain("&technicianRef=tech-1");
  });

  it("trims additionalRequest and omits it entirely when blank", () => {
    const blank = buildBookingIntentPreviewUrl(bookingUrl, {
      startsAt: "2026-09-20T15:00",
      salonId: null,
      serviceIds: [],
      technicianRef: null,
      additionalRequest: "   ",
    });
    expect(blank).not.toContain("additionalRequest");

    const trimmed = buildBookingIntentPreviewUrl(bookingUrl, {
      startsAt: "2026-09-20T15:00",
      salonId: null,
      serviceIds: [],
      technicianRef: null,
      additionalRequest: "  gel polish please  ",
    });
    expect(trimmed).toContain(`additionalRequest=${encodeURIComponent("gel polish please")}`);
  });
});

describe("resolveStartsAtIssue", () => {
  const timezone = "Europe/Berlin";
  const minLeadTimeMinutes = 15;
  const now = Date.parse("2026-09-20T10:00:00Z");

  it("flags a missing value", () => {
    expect(resolveStartsAtIssue(null, timezone, minLeadTimeMinutes, now)).toBe("missing");
  });

  it("flags an unparseable value", () => {
    expect(resolveStartsAtIssue("not-a-date", timezone, minLeadTimeMinutes, now)).toBe(
      "unparseable",
    );
  });

  it("flags exactly now + minLeadTime as too_soon, matching the server's <= comparison", () => {
    const exact = new Date(now + minLeadTimeMinutes * 60_000);
    const wallClock = exact.toISOString().slice(0, 16);
    // toISOString is UTC; Europe/Berlin in September is UTC+2, so build the
    // wall clock through the same offset the server would see. Simplest way
    // to hit the exact boundary deterministically: pick a UTC timezone.
    expect(resolveStartsAtIssue(wallClock, "UTC", minLeadTimeMinutes, now)).toBe("too_soon");
  });

  it("accepts a time strictly after the lead time", () => {
    const later = new Date(now + (minLeadTimeMinutes + 1) * 60_000);
    const wallClock = later.toISOString().slice(0, 16);
    expect(resolveStartsAtIssue(wallClock, "UTC", minLeadTimeMinutes, now)).toBeNull();
  });

  it("does not reject a spring-forward gap time -- date-fns-tz shifts it silently", () => {
    // 2026-03-29 02:30 does not exist in Europe/Berlin (clocks jump 2:00->3:00).
    const issue = resolveStartsAtIssue(
      "2026-03-29T02:30",
      timezone,
      minLeadTimeMinutes,
      Date.parse("2026-03-01T00:00:00Z"),
    );
    expect(issue).toBeNull();
  });
});

describe("catalogSum", () => {
  it("returns the sum when every value is set", () => {
    expect(catalogSum([25.5, 30])).toEqual({ total: 55.5, missing: 0 });
  });

  it("returns null when any value is null, never a partial sum", () => {
    expect(catalogSum([25.5, null])).toEqual({ total: null, missing: 1 });
  });

  it("returns null for an empty list", () => {
    expect(catalogSum([])).toEqual({ total: null, missing: 0 });
  });
});

describe("servicesForSalon", () => {
  const services = [
    { id: "a", salonIds: [] },
    { id: "b", salonIds: ["salon-1"] },
    { id: "c", salonIds: ["salon-2"] },
  ];

  it("treats an empty salonIds as available at every salon", () => {
    const result = servicesForSalon(services, "salon-2");
    expect(result.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("returns every service when no salon is chosen", () => {
    expect(servicesForSalon(services, null)).toHaveLength(3);
  });
});
