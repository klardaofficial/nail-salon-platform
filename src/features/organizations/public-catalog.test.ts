import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/features/organizations/providers", () => ({
  buildBookingIntentUrl: (organizationId: string) =>
    `https://example.com/api/public/${organizationId}/booking-intent`,
}));

import { readPublicCatalog } from "./public-catalog";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const SALON_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_SALON_ID = "00000000-0000-4000-8000-000000000202";
const INACTIVE_SALON_ID = "00000000-0000-4000-8000-000000000203";
const SERVICE_ID = "00000000-0000-4000-8000-000000000301";
const TECHNICIAN_ID = "00000000-0000-4000-8000-000000000401";

type StubResponse = { data?: unknown; error?: unknown };

// FIFO-per-table Supabase stub, mirroring the style in
// src/features/booking-intents/create.test.ts: each call against a given
// table shifts the next queued response for that table. readPublicCatalog
// issues exactly one query per table (organizations, organization_settings,
// salons, services, technicians), so a single push per table is enough.
function createSupabaseStub() {
  const queues: Record<string, StubResponse[]> = {};

  function push(table: string, response: StubResponse) {
    (queues[table] ??= []).push(response);
  }

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order"]) {
      query[method] = () => query;
    }
    const resolve = () => {
      const queue = queues[table];
      const response = queue?.length ? queue.shift()! : { data: null, error: null };
      return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
    };
    query.single = resolve;
    query.maybeSingle = resolve;
    query.then = (onFulfilled: (value: unknown) => unknown) => resolve().then(onFulfilled);
    return query;
  });

  return { from, push };
}

const DEFAULT_SETTINGS = {
  platform_timezone: "Europe/Berlin",
  default_open_time: "09:00:00",
  default_close_time: "18:00:00",
  default_booking_interval_minutes: 30,
  bot_locale: "de",
  currency: "EUR",
};

function seedActiveOrganization(stub: ReturnType<typeof createSupabaseStub>) {
  stub.push("organizations", {
    data: { id: ORGANIZATION_ID, name: "Glow Nails", status: "active" },
  });
  stub.push("organization_settings", { data: DEFAULT_SETTINGS });
}

describe("readPublicCatalog", () => {
  it("returns null for an organization that does not exist", async () => {
    const stub = createSupabaseStub();
    stub.push("organizations", { data: null });
    mocks.from.mockImplementation(stub.from);

    expect(await readPublicCatalog(ORGANIZATION_ID)).toBeNull();
  });

  it("returns null for an archived organization", async () => {
    const stub = createSupabaseStub();
    stub.push("organizations", {
      data: { id: ORGANIZATION_ID, name: "Glow Nails", status: "archived" },
    });
    mocks.from.mockImplementation(stub.from);

    expect(await readPublicCatalog(ORGANIZATION_ID)).toBeNull();
  });

  it("returns an empty catalog when the owner has not set up salons, services, or technicians", async () => {
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [] });
    stub.push("services", { data: [] });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);

    expect(catalog).toMatchObject({
      organization: { id: ORGANIZATION_ID, name: "Glow Nails" },
      bookingUrl: `https://example.com/api/public/${ORGANIZATION_ID}/booking-intent`,
      bookingTimezone: "Europe/Berlin",
      openTime: "09:00",
      closeTime: "18:00",
      bookingIntervalMinutes: 30,
      defaultLanguage: "de",
      currency: { code: "EUR", name: "Euro", symbol: "€" },
      salonSelection: "none",
      salons: [],
      services: [],
      technicians: [],
    });
    // No wa_id, avatar_url, business_id, or per-salon timezone/hours ever
    // reach the response -- they are simply never selected/mapped in.
    expect(catalog).not.toHaveProperty("salons.0.timezone");
  });

  it.each([
    { salons: [], expected: "none" },
    { salons: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }], expected: "implicit" },
    {
      salons: [
        { id: SALON_ID, name: "Main", location_label: "Downtown" },
        { id: OTHER_SALON_ID, name: "Uptown", location_label: "Uptown" },
      ],
      expected: "required",
    },
  ])("derives salonSelection $expected from active salon count", async ({ salons, expected }) => {
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: salons });
    stub.push("services", { data: [] });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.salonSelection).toBe(expected);
  });

  it("keeps an unscoped service with an empty salonIds array (available at every salon)", async () => {
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }] });
    stub.push("services", {
      data: [
        {
          id: SERVICE_ID,
          name: "Manicure",
          description: null,
          price: null,
          duration_minutes: null,
          service_salons: [],
        },
      ],
    });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.services).toEqual([
      {
        id: SERVICE_ID,
        name: "Manicure",
        description: null,
        price: null,
        durationMinutes: null,
        salonIds: [],
      },
    ]);
  });

  it("intersects a scoped service's salons with the active salons", async () => {
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }] });
    stub.push("services", {
      data: [
        {
          id: SERVICE_ID,
          name: "Manicure",
          description: "Classic manicure",
          price: 25.5,
          duration_minutes: 45,
          service_salons: [{ salon_id: SALON_ID }, { salon_id: INACTIVE_SALON_ID }],
        },
      ],
    });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.services).toEqual([
      {
        id: SERVICE_ID,
        name: "Manicure",
        description: "Classic manicure",
        price: 25.5,
        durationMinutes: 45,
        salonIds: [SALON_ID],
      },
    ]);
  });

  it("drops a service scoped only to inactive salons rather than emitting an empty salonIds array", async () => {
    // A naive intersection would yield salonIds: [], which means "available
    // everywhere" for an unscoped service -- the opposite of the truth here.
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }] });
    stub.push("services", {
      data: [
        {
          id: SERVICE_ID,
          name: "Manicure",
          description: null,
          price: null,
          duration_minutes: null,
          service_salons: [{ salon_id: INACTIVE_SALON_ID }],
        },
      ],
    });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.services).toEqual([]);
  });

  it("normalizes a numeric-as-string price to a number and never coerces a null price/duration to zero", async () => {
    // PostgREST can surface a `numeric` column as a string; the catalog must
    // still emit a JSON number. A service with only one of price/duration set
    // must keep the other as null, never 0 or a dropped key.
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }] });
    stub.push("services", {
      data: [
        {
          id: SERVICE_ID,
          name: "Manicure",
          description: null,
          price: "25.50",
          duration_minutes: null,
          service_salons: [],
        },
      ],
    });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.services).toEqual([
      {
        id: SERVICE_ID,
        name: "Manicure",
        description: null,
        price: 25.5,
        durationMinutes: null,
        salonIds: [],
      },
    ]);
  });

  it("omits a technician assigned to an inactive salon", async () => {
    const stub = createSupabaseStub();
    seedActiveOrganization(stub);
    stub.push("salons", { data: [{ id: SALON_ID, name: "Main", location_label: "Downtown" }] });
    stub.push("services", { data: [] });
    stub.push("technicians", {
      data: [
        { id: TECHNICIAN_ID, display_name: "Kim", salon_id: SALON_ID },
        {
          id: "00000000-0000-4000-8000-000000000402",
          display_name: "Retired Tech",
          salon_id: INACTIVE_SALON_ID,
        },
      ],
    });
    mocks.from.mockImplementation(stub.from);

    const catalog = await readPublicCatalog(ORGANIZATION_ID);
    expect(catalog?.technicians).toEqual([
      { id: TECHNICIAN_ID, displayName: "Kim", salonId: SALON_ID },
    ]);
  });

  it("throws when organization_settings is missing (create_organization inserts it atomically)", async () => {
    const stub = createSupabaseStub();
    stub.push("organizations", {
      data: { id: ORGANIZATION_ID, name: "Glow Nails", status: "active" },
    });
    stub.push("organization_settings", { error: { message: "no rows" } });
    stub.push("salons", { data: [] });
    stub.push("services", { data: [] });
    stub.push("technicians", { data: [] });
    mocks.from.mockImplementation(stub.from);

    await expect(readPublicCatalog(ORGANIZATION_ID)).rejects.toEqual({ message: "no rows" });
  });
});
