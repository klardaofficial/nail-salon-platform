import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  normalizeServiceSelections: vi.fn(),
  createLocalizedText: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/features/conversation/tools", () => ({
  normalizeServiceSelections: mocks.normalizeServiceSelections,
}));
vi.mock("@/features/conversation/localize", () => ({
  createLocalizedText: mocks.createLocalizedText,
}));

import { AI_MESSAGE_CAP_PER_HOUR, createBookingIntent } from "./create";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const SALON_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_SALON_ID = "00000000-0000-4000-8000-000000000202";
const TECHNICIAN_ID = "00000000-0000-4000-8000-000000000401";
const SERVICE_ID = "00000000-0000-4000-8000-000000000301";

type StubResponse = { data?: unknown; error?: unknown; count?: number };

// FIFO-per-table Supabase stub: each call against a given table shifts the
// next queued response, mirroring the fixed call order createBookingIntent
// issues for a given code path (see queue setup in each test below).
function createSupabaseStub() {
  const queues: Record<string, StubResponse[]> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function push(table: string, response: StubResponse) {
    (queues[table] ??= []).push(response);
  }

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "is",
      "in",
      "not",
      "order",
      "limit",
      "gt",
      "gte",
      "lt",
      "lte",
      "insert",
      "update",
      "upsert",
    ]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }
    const resolve = () => {
      const queue = queues[table];
      const response = queue?.length ? queue.shift()! : { data: null, error: null };
      return Promise.resolve({
        data: response.data ?? null,
        error: response.error ?? null,
        count: response.count ?? null,
      });
    };
    query.single = resolve;
    query.maybeSingle = resolve;
    query.then = (onFulfilled: (value: unknown) => unknown) => resolve().then(onFulfilled);
    return query;
  });

  return { from, push, calls };
}

let stub: ReturnType<typeof createSupabaseStub>;

function futureNaiveDateTime(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function seedDefaults() {
  stub.push("salons", { data: [{ id: SALON_ID, name: "Mitte" }] });
  stub.push("organization_settings", {
    data: { platform_timezone: "UTC", bot_locale: "en" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stub = createSupabaseStub();
  mocks.from.mockImplementation(stub.from);
  mocks.normalizeServiceSelections.mockResolvedValue([]);
  mocks.createLocalizedText.mockResolvedValue("AI-written booking request.");
});

describe("createBookingIntent", () => {
  it("creates a new intent and returns an AI-authored message under the hourly cap", async () => {
    seedDefaults();
    stub.push("booking_intents", { data: null }); // reuse lookup: none
    stub.push("booking_intents", { count: 0 }); // AI cap count
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    }); // insert

    const result = await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
    });

    expect(result.locale).toBe("en");
    expect(result.messageText).toBe("[BK-ABCDEFGHJKMNP] AI-written booking request.");
    expect(mocks.createLocalizedText).toHaveBeenCalledTimes(1);

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect(insertCall?.args[0]).toMatchObject({
      organization_id: ORGANIZATION_ID,
      salon_id: SALON_ID,
      technician_ref: null,
      message_source: "ai",
    });
  });

  it("rejects a time inside the minimum lead window", async () => {
    seedDefaults();

    await expect(
      createBookingIntent(ORGANIZATION_ID, {
        salonId: SALON_ID,
        startsAt: futureNaiveDateTime(0), // ~now, well under 15 minutes
      }),
    ).rejects.toMatchObject({ code: "booking_time_must_be_in_future" });
  });

  it("rejects a salon that is not active for this organization", async () => {
    stub.push("salons", { data: [{ id: OTHER_SALON_ID, name: "Elsewhere" }] });
    stub.push("organization_settings", { data: { platform_timezone: "UTC", bot_locale: "en" } });

    await expect(
      createBookingIntent(ORGANIZATION_ID, { salonId: SALON_ID, startsAt: futureNaiveDateTime(2) }),
    ).rejects.toMatchObject({ code: "salon_is_not_active" });
  });

  it("drops a technician who does not belong to the requested salon", async () => {
    seedDefaults();
    stub.push("technicians", {
      data: { display_name: "Lee", salon_id: OTHER_SALON_ID, active: true },
    });
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
      technicianRef: TECHNICIAN_ID,
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).technician_ref).toBeNull();
    expect(mocks.createLocalizedText).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ technician: "[N/A]" }) }),
    );
  });

  it("drops an inactive technician even when the salon matches", async () => {
    seedDefaults();
    stub.push("technicians", { data: { display_name: "Lee", salon_id: SALON_ID, active: false } });
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
      technicianRef: TECHNICIAN_ID,
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).technician_ref).toBeNull();
  });

  it("keeps a technician who is active and belongs to the salon", async () => {
    seedDefaults();
    stub.push("technicians", { data: { display_name: "Lee", salon_id: SALON_ID, active: true } });
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
      technicianRef: TECHNICIAN_ID,
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).technician_ref).toBe(TECHNICIAN_ID);
    expect(mocks.createLocalizedText).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ technician: "Lee" }) }),
    );
  });

  it("drops a service id that does not resolve to an active catalog entry", async () => {
    seedDefaults();
    mocks.normalizeServiceSelections.mockResolvedValue([{ serviceId: null, name: "" }]);
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
      serviceIds: [SERVICE_ID],
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).service_selections).toEqual([]);
  });

  it("reuses an unconsumed intent with a matching fingerprint instead of inserting a new one", async () => {
    seedDefaults();
    stub.push("booking_intents", {
      data: { code: "EXISTINGCODE1", message_text: "Existing text.", locale: "en" },
    }); // reuse select finds a match
    stub.push("booking_intents", { data: null, error: null }); // extend expires_at update

    const result = await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
    });

    expect(result.messageText).toBe("[BK-EXISTINGCODE1] Existing text.");
    expect(mocks.createLocalizedText).not.toHaveBeenCalled();
    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect(insertCall).toBeUndefined();
    const updateCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "update",
    );
    expect(updateCall).toBeDefined();
  });

  it("falls back to the deterministic template once the hourly AI cap is reached", async () => {
    seedDefaults();
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: AI_MESSAGE_CAP_PER_HOUR });
    stub.push("booking_intents", {
      data: {
        code: "ABCDEFGHJKMNP",
        message_text: `I'd like to book at Mitte on ${futureNaiveDateTime(2).replace("T", " ")}.`,
        locale: "en",
      },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
    });

    expect(mocks.createLocalizedText).not.toHaveBeenCalled();
    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).message_source).toBe("template");
  });

  it("falls back to the deterministic template when localization returns null", async () => {
    seedDefaults();
    mocks.createLocalizedText.mockResolvedValue(null);
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "fallback text", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).message_source).toBe("template");
  });

  it("implicitly selects the sole active salon when salonId is omitted", async () => {
    seedDefaults();
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: { code: "ABCDEFGHJKMNP", message_text: "AI-written booking request.", locale: "en" },
    });

    await createBookingIntent(ORGANIZATION_ID, { startsAt: futureNaiveDateTime(2) });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect((insertCall?.args[0] as Record<string, unknown>).salon_id).toBe(SALON_ID);
  });

  it("leaves salon null (and drops any technician) when there are no active salons and salonId is omitted", async () => {
    stub.push("salons", { data: [] });
    stub.push("organization_settings", { data: { platform_timezone: "UTC", bot_locale: "en" } });
    stub.push("booking_intents", { data: null });
    stub.push("booking_intents", { count: 0 });
    stub.push("booking_intents", {
      data: {
        code: "ABCDEFGHJKMNP",
        message_text: "I'd like to book an appointment.",
        locale: "en",
      },
    });

    await createBookingIntent(ORGANIZATION_ID, {
      startsAt: futureNaiveDateTime(2),
      technicianRef: TECHNICIAN_ID,
    });

    const insertCall = stub.calls.find(
      (call) => call.table === "booking_intents" && call.method === "insert",
    );
    expect(insertCall?.args[0]).toMatchObject({ salon_id: null, technician_ref: null });
    // No salon means no technician lookup either -- confirmed by no queued
    // "technicians" response being required for this call to resolve.
    expect(mocks.createLocalizedText).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ salon: "[N/A]" }) }),
    );
  });

  it("rejects an omitted salonId when more than one active salon exists", async () => {
    stub.push("salons", {
      data: [
        { id: SALON_ID, name: "Mitte" },
        { id: OTHER_SALON_ID, name: "Elsewhere" },
      ],
    });
    stub.push("organization_settings", { data: { platform_timezone: "UTC", bot_locale: "en" } });

    await expect(
      createBookingIntent(ORGANIZATION_ID, { startsAt: futureNaiveDateTime(2) }),
    ).rejects.toMatchObject({ code: "salon_selection_required" });
  });

  it("re-selects the concurrent winner on a fingerprint unique-index conflict instead of erroring", async () => {
    seedDefaults();
    stub.push("booking_intents", { data: null }); // first reuse lookup: none yet
    stub.push("booking_intents", { count: 0 }); // AI cap count
    stub.push("booking_intents", { error: { code: "23505", message: "duplicate key" } }); // insert loses the race
    stub.push("booking_intents", {
      data: { code: "WINNERCODE123", message_text: "Winner text.", locale: "en" },
    }); // reuse lookup after conflict: the concurrent winner
    stub.push("booking_intents", { data: null, error: null }); // extend expires_at on the winner

    const result = await createBookingIntent(ORGANIZATION_ID, {
      salonId: SALON_ID,
      startsAt: futureNaiveDateTime(2),
    });

    expect(result.messageText).toBe("[BK-WINNERCODE123] Winner text.");
  });
});
