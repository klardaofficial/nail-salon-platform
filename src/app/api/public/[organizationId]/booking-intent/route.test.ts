import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBookingIntent: vi.fn(),
  resolveEffectiveMetaConfiguration: vi.fn(),
  clickToChatUrlWithText: vi.fn(
    (digits: string, text: string) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
  ),
}));
vi.mock("@/features/booking-intents/create", () => ({
  createBookingIntent: mocks.createBookingIntent,
}));
vi.mock("@/features/organizations/providers", () => ({
  resolveEffectiveMetaConfiguration: mocks.resolveEffectiveMetaConfiguration,
  clickToChatUrlWithText: mocks.clickToChatUrlWithText,
}));

import { GET } from "./route";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const E164_DIGITS = "4915112345678";

function requestFor(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  return new Request(`https://example.com/api/public/${ORGANIZATION_ID}/booking-intent?${search}`);
}

function contextFor(organizationId = ORGANIZATION_ID) {
  return { params: Promise.resolve({ organizationId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clickToChatUrlWithText.mockImplementation(
    (digits: string, text: string) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
  );
});

describe("GET /api/public/[organizationId]/booking-intent", () => {
  it("redirects to the wa.me prefill link on a successful intent", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
      readiness: "enabled",
      e164Digits: E164_DIGITS,
    });
    mocks.createBookingIntent.mockResolvedValue({
      code: "ABCDEFGHJKMNP",
      messageText: "[BK-ABCDEFGHJKMNP] I'd like to book a manicure.",
      locale: "en",
    });

    const response = await GET(
      requestFor({
        salonId: "00000000-0000-4000-8000-000000000201",
        startsAt: "2099-09-18T15:00",
        serviceIds: "00000000-0000-4000-8000-000000000301,00000000-0000-4000-8000-000000000302",
        technicianRef: "00000000-0000-4000-8000-000000000401",
        additionalRequest: "extra shiny please",
      }),
      contextFor(),
    );

    expect(response.status).toBe(307);
    // Compare through URL/URLSearchParams rather than a raw string: the
    // WHATWG URL serializer NextResponse.redirect() goes through percent-
    // encodes a few extra characters (e.g. "'") for special schemes that
    // encodeURIComponent leaves untouched, so a literal string comparison
    // would be asserting an implementation detail of that serializer.
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(`https://wa.me/${E164_DIGITS}`);
    expect(location.searchParams.get("text")).toBe(
      "[BK-ABCDEFGHJKMNP] I'd like to book a manicure.",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createBookingIntent).toHaveBeenCalledWith(ORGANIZATION_ID, {
      salonId: "00000000-0000-4000-8000-000000000201",
      startsAt: "2099-09-18T15:00",
      serviceIds: ["00000000-0000-4000-8000-000000000301", "00000000-0000-4000-8000-000000000302"],
      technicianRef: "00000000-0000-4000-8000-000000000401",
      additionalRequest: "extra shiny please",
    });
  });

  it("defaults optional fields to empty/null when omitted", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
      readiness: "enabled",
      e164Digits: E164_DIGITS,
    });
    mocks.createBookingIntent.mockResolvedValue({
      code: "ABCDEFGHJKMNP",
      messageText: "[BK-ABCDEFGHJKMNP] text",
      locale: "en",
    });

    await GET(requestFor({ startsAt: "2099-09-18T15:00" }), contextFor());

    // salonId is omitted here on purpose: an organization with zero or one
    // active salon does not require the external site to send one.
    expect(mocks.createBookingIntent).toHaveBeenCalledWith(ORGANIZATION_ID, {
      salonId: null,
      startsAt: "2099-09-18T15:00",
      serviceIds: [],
      technicianRef: null,
      additionalRequest: null,
    });
  });

  it("returns a JSON error when there is no validated WhatsApp destination", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
      readiness: "unvalidated",
      e164Digits: null,
    });

    const response = await GET(
      requestFor({ salonId: "00000000-0000-4000-8000-000000000201", startsAt: "2099-09-18T15:00" }),
      contextFor(),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("booking_intent_unavailable");
    expect(mocks.createBookingIntent).not.toHaveBeenCalled();
  });

  it("returns a JSON error when the organization has no provider configuration at all", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue(null);

    const response = await GET(
      requestFor({ salonId: "00000000-0000-4000-8000-000000000201", startsAt: "2099-09-18T15:00" }),
      contextFor(),
    );

    expect(response.status).toBe(404);
  });

  it("degrades to a plain wa.me greeting when createBookingIntent throws after a destination is resolved", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
      readiness: "enabled",
      e164Digits: E164_DIGITS,
    });
    mocks.createBookingIntent.mockRejectedValue(new Error("booking_time_must_be_in_future"));

    const response = await GET(
      requestFor({ salonId: "00000000-0000-4000-8000-000000000201", startsAt: "2099-09-18T00:01" }),
      contextFor(),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(`https://wa.me/${E164_DIGITS}`);
    expect(location.searchParams.get("text")).toBe("👋");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a JSON error (not a redirect) when resolving the destination itself throws", async () => {
    mocks.resolveEffectiveMetaConfiguration.mockRejectedValue(new Error("database unreachable"));

    const response = await GET(
      requestFor({ salonId: "00000000-0000-4000-8000-000000000201", startsAt: "2099-09-18T15:00" }),
      contextFor(),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("server_error");
  });
});
