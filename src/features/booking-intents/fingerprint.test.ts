import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fingerprintBookingIntent, type BookingIntentFingerprintInput } from "./fingerprint";

const base: BookingIntentFingerprintInput = {
  organizationId: "00000000-0000-4000-8000-000000000101",
  salonId: "00000000-0000-4000-8000-000000000201",
  startsAtIso: "2099-09-18T15:00:00.000Z",
  services: [
    { serviceId: "00000000-0000-4000-8000-000000000301", name: "Manicure" },
    { serviceId: "00000000-0000-4000-8000-000000000302", name: "Pedicure" },
  ],
  technicianRef: null,
  additionalRequest: null,
  locale: "en",
};

describe("fingerprintBookingIntent", () => {
  it("is deterministic for identical input", () => {
    expect(fingerprintBookingIntent(base)).toBe(fingerprintBookingIntent(base));
  });

  it("is independent of service selection order", () => {
    const reordered = { ...base, services: [...base.services].reverse() };
    expect(fingerprintBookingIntent(reordered)).toBe(fingerprintBookingIntent(base));
  });

  it("is independent of service name casing/whitespace", () => {
    const messy = {
      ...base,
      services: base.services.map((service) => ({
        ...service,
        name: `  ${service.name.toUpperCase()}  `,
      })),
    };
    expect(fingerprintBookingIntent(messy)).toBe(fingerprintBookingIntent(base));
  });

  it("treats an empty/whitespace additionalRequest as no request", () => {
    const withBlank = { ...base, additionalRequest: "   " };
    const withNull = { ...base, additionalRequest: null };
    expect(fingerprintBookingIntent(withBlank)).toBe(fingerprintBookingIntent(withNull));
  });

  it.each([
    ["organizationId", { organizationId: "00000000-0000-4000-8000-000000000999" }],
    ["salonId", { salonId: "00000000-0000-4000-8000-000000000999" }],
    ["startsAtIso", { startsAtIso: "2099-09-18T16:00:00.000Z" }],
    ["technicianRef", { technicianRef: "00000000-0000-4000-8000-000000000401" }],
    ["additionalRequest", { additionalRequest: "extra shiny please" }],
    ["locale", { locale: "de" }],
  ])("changes the fingerprint when %s differs", (_label, override) => {
    expect(fingerprintBookingIntent({ ...base, ...override })).not.toBe(
      fingerprintBookingIntent(base),
    );
  });

  it("changes the fingerprint when the service set differs", () => {
    const fewerServices = { ...base, services: base.services.slice(0, 1) };
    expect(fingerprintBookingIntent(fewerServices)).not.toBe(fingerprintBookingIntent(base));
  });

  it("is deterministic and distinct for a null salonId (no active salons)", () => {
    const noSalon = { ...base, salonId: null };
    expect(fingerprintBookingIntent(noSalon)).toBe(fingerprintBookingIntent(noSalon));
    expect(fingerprintBookingIntent(noSalon)).not.toBe(fingerprintBookingIntent(base));
  });
});
