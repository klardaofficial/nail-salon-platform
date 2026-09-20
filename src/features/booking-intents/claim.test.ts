import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getConversationTimezone: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/features/conversation/datetime", () => ({
  getConversationTimezone: mocks.getConversationTimezone,
}));

import { claimBookingIntentByCode } from "./claim";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000901";
const SALON_ID = "00000000-0000-4000-8000-000000000201";
const TECHNICIAN_ID = "00000000-0000-4000-8000-000000000401";
const CODE = "ABCDEFGHJKMNP";

type StubResponse = { data?: unknown; error?: unknown };

// FIFO-per-table stub, matching the fixed call order claimBookingIntentByCode
// issues for a given code path: the atomic claim, then (only on a successful
// claim) salon re-validation, optional technician re-validation, and finally
// the booking_drafts upsert.
function createSupabaseStub() {
  const queues: Record<string, StubResponse[]> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function push(table: string, response: StubResponse) {
    (queues[table] ??= []).push(response);
  }

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "gt", "update", "upsert"]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }
    const resolve = () => {
      const queue = queues[table];
      const response = queue?.length ? queue.shift()! : { data: null, error: null };
      return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
    };
    query.maybeSingle = resolve;
    query.then = (onFulfilled: (value: unknown) => unknown) => resolve().then(onFulfilled);
    return query;
  });

  return { from, push, calls };
}

let stub: ReturnType<typeof createSupabaseStub>;

const claimedIntentRow = {
  salon_id: SALON_ID,
  starts_at: "2099-09-18T15:00:00.000Z",
  service_selections: [{ serviceId: null, name: "Manicure" }],
  technician_ref: null,
  additional_request: "extra shiny",
};

beforeEach(() => {
  vi.clearAllMocks();
  stub = createSupabaseStub();
  mocks.from.mockImplementation(stub.from);
  mocks.getConversationTimezone.mockResolvedValue("Asia/Bangkok");
});

describe("claimBookingIntentByCode", () => {
  it("returns false for an unknown, expired, or already-consumed code without touching booking_drafts", async () => {
    stub.push("booking_intents", { data: null }); // atomic claim finds no matching row

    const claimed = await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    expect(claimed).toBeNull();
    expect(stub.calls.some((call) => call.table === "salons")).toBe(false);
    expect(stub.calls.some((call) => call.table === "booking_drafts")).toBe(false);
  });

  it("claims once, re-validates the salon, and seeds booking_drafts with origin external_site", async () => {
    stub.push("booking_intents", { data: claimedIntentRow });
    stub.push("salons", { data: { id: SALON_ID } });
    stub.push("booking_drafts", { data: null, error: null });

    const claimed = await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    expect(claimed).toBeTruthy();
    expect(claimed).toMatchObject({
      code: CODE,
      salonId: SALON_ID,
      technicianRef: null,
      startsAt: claimedIntentRow.starts_at,
      serviceSelections: claimedIntentRow.service_selections,
      additionalRequest: "extra shiny",
      timezone: "Asia/Bangkok",
    });
    const upsertCall = stub.calls.find(
      (call) => call.table === "booking_drafts" && call.method === "upsert",
    );
    expect(upsertCall?.args[0]).toMatchObject({
      organization_id: ORGANIZATION_ID,
      conversation_id: CONVERSATION_ID,
      salon_id: SALON_ID,
      timezone: "Asia/Bangkok",
      technician_ref: null,
      additional_request: "extra shiny",
      state: "collecting",
      origin: "external_site",
    });
    expect(upsertCall?.args[1]).toEqual({ onConflict: "conversation_id" });
  });

  it("is single-use: the atomic update only matches the row once, so a replayed claim finds nothing", async () => {
    // First call: the exactly-once conditional UPDATE (consumed_at is null,
    // expires_at in the future) matches and consumes the row.
    stub.push("booking_intents", { data: claimedIntentRow });
    stub.push("salons", { data: { id: SALON_ID } });
    stub.push("booking_drafts", { data: null, error: null });
    // Second call for the same code: the row is now consumed, so the same
    // conditional UPDATE matches nothing.
    stub.push("booking_intents", { data: null });

    const first = await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);
    const second = await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(stub.calls.filter((call) => call.table === "booking_drafts").length).toBe(1);
  });

  it("seeds a null salon straight through without a salon lookup (no active salons at intent-creation time)", async () => {
    stub.push("booking_intents", { data: { ...claimedIntentRow, salon_id: null } });
    stub.push("booking_drafts", { data: null, error: null });

    await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    expect(stub.calls.some((call) => call.table === "salons")).toBe(false);
    expect(stub.calls.some((call) => call.table === "technicians")).toBe(false);
    const upsertCall = stub.calls.find(
      (call) => call.table === "booking_drafts" && call.method === "upsert",
    );
    expect(upsertCall?.args[0]).toMatchObject({ salon_id: null, technician_ref: null });
  });

  it("drops the salon reference when the claimed salon is no longer active, and skips technician lookup", async () => {
    stub.push("booking_intents", { data: { ...claimedIntentRow, technician_ref: TECHNICIAN_ID } });
    stub.push("salons", { data: null }); // salon no longer active/deleted
    stub.push("booking_drafts", { data: null, error: null });

    await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    expect(stub.calls.some((call) => call.table === "technicians")).toBe(false);
    const upsertCall = stub.calls.find(
      (call) => call.table === "booking_drafts" && call.method === "upsert",
    );
    expect(upsertCall?.args[0]).toMatchObject({ salon_id: null, technician_ref: null });
  });

  it("drops a technician who no longer belongs to the claimed salon or is inactive", async () => {
    stub.push("booking_intents", { data: { ...claimedIntentRow, technician_ref: TECHNICIAN_ID } });
    stub.push("salons", { data: { id: SALON_ID } });
    stub.push("technicians", { data: { salon_id: SALON_ID, active: false } });
    stub.push("booking_drafts", { data: null, error: null });

    await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    const upsertCall = stub.calls.find(
      (call) => call.table === "booking_drafts" && call.method === "upsert",
    );
    expect((upsertCall?.args[0] as Record<string, unknown>).technician_ref).toBeNull();
  });

  it("keeps a technician who is active and still belongs to the claimed salon", async () => {
    stub.push("booking_intents", { data: { ...claimedIntentRow, technician_ref: TECHNICIAN_ID } });
    stub.push("salons", { data: { id: SALON_ID } });
    stub.push("technicians", { data: { salon_id: SALON_ID, active: true } });
    stub.push("booking_drafts", { data: null, error: null });

    await claimBookingIntentByCode(ORGANIZATION_ID, CONVERSATION_ID, CODE);

    const upsertCall = stub.calls.find(
      (call) => call.table === "booking_drafts" && call.method === "upsert",
    );
    expect((upsertCall?.args[0] as Record<string, unknown>).technician_ref).toBe(TECHNICIAN_ID);
  });
});
