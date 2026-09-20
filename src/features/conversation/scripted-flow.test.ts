import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaimedBookingIntent } from "@/features/booking-intents/claim";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("./notifications", () => ({
  queueTechnicianBookingNotification: mocks.notify,
}));

import {
  cancelBookingForContact,
  confirmBookingFromIntent,
  formatCancelAction,
  parseCancelAction,
} from "./scripted-flow";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const BUSINESS_ID = "00000000-0000-4000-8000-000000000701";
const CONTACT_ID = "00000000-0000-4000-8000-000000000801";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000901";
const TECHNICIAN_ID = "6fcb66a0-d713-4bfc-a075-0e7d3864bafe";
const BOOKING_ID = "6fcb66a0-d713-4bfc-a075-0e7d3864bafd";

// Single value per table, matching conversation.test.ts's stub -- every
// scripted-flow query touches a distinct table within one call, so this is
// sufficient without a FIFO queue.
const tables = new Map<string, unknown>();

beforeEach(() => {
  vi.clearAllMocks();
  tables.clear();
  tables.set("salons", null);
  tables.set("technicians", null);
  tables.set("businesses", { id: BUSINESS_ID, active: true });
  tables.set("booking_drafts", null);
  tables.set("contacts", { display_name: "Jane", wa_id: "49151111111" });
  tables.set("bookings", null);
  tables.set("organization_settings", { platform_timezone: "Asia/Bangkok" });
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "update"]) {
      query[method] = (...args: unknown[]) => {
        void args;
        return query;
      };
    }
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: tables.get(table) ?? null, error: null }).then(resolve);
    query.single = () => Promise.resolve({ data: tables.get(table) ?? null, error: null });
    query.maybeSingle = () => Promise.resolve({ data: tables.get(table) ?? null, error: null });
    return query;
  });
  mocks.rpc.mockResolvedValue({ data: BOOKING_ID, error: null });
  mocks.notify.mockResolvedValue(undefined);
});

function baseClaim(overrides: Partial<ClaimedBookingIntent> = {}): ClaimedBookingIntent {
  return {
    code: "ABCDEFGHJKMNP",
    salonId: null,
    technicianRef: null,
    startsAt: "2099-09-18T15:00:00+07:00",
    serviceSelections: [{ name: "Manicure" }],
    additionalRequest: null,
    timezone: "Asia/Bangkok",
    ...overrides,
  };
}

describe("formatCancelAction / parseCancelAction", () => {
  it("round-trips a booking id through the interactive action id", () => {
    const actionId = formatCancelAction(BOOKING_ID);
    expect(actionId).toBe(`booking:cancel:${BOOKING_ID}`);
    expect(parseCancelAction(actionId)).toBe(BOOKING_ID);
  });

  it("rejects ids that are not the cancel-action shape or not a UUID", () => {
    expect(parseCancelAction(null)).toBeNull();
    expect(parseCancelAction(undefined)).toBeNull();
    expect(parseCancelAction("")).toBeNull();
    expect(parseCancelAction("something-else")).toBeNull();
    expect(parseCancelAction("booking:cancel:not-a-uuid")).toBeNull();
    expect(parseCancelAction("booking:cancel:")).toBeNull();
  });
});

describe("confirmBookingFromIntent", () => {
  it("returns unavailable without querying the database when the slot is already in the past", async () => {
    const result = await confirmBookingFromIntent({
      organizationId: ORGANIZATION_ID,
      businessId: BUSINESS_ID,
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      claim: baseClaim({ startsAt: "2000-01-01T00:00:00Z" }),
    });
    expect(result).toEqual({ outcome: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns unavailable when the business is no longer active", async () => {
    tables.set("businesses", { id: BUSINESS_ID, active: false });
    const result = await confirmBookingFromIntent({
      organizationId: ORGANIZATION_ID,
      businessId: BUSINESS_ID,
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      claim: baseClaim(),
    });
    expect(result).toEqual({ outcome: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes the RPC an intent:<code> idempotency key", async () => {
    await confirmBookingFromIntent({
      organizationId: ORGANIZATION_ID,
      businessId: BUSINESS_ID,
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      claim: baseClaim(),
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_organization_booking",
      expect.objectContaining({ p_idempotency_key: "intent:ABCDEFGHJKMNP" }),
    );
  });

  it("maps a booking_time_must_be_in_future RPC error to the unavailable outcome", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("booking_time_must_be_in_future"));
    const result = await confirmBookingFromIntent({
      organizationId: ORGANIZATION_ID,
      businessId: BUSINESS_ID,
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      claim: baseClaim(),
    });
    expect(result).toEqual({ outcome: "unavailable" });
  });

  it("rethrows any other RPC error", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("some other failure"));
    await expect(
      confirmBookingFromIntent({
        organizationId: ORGANIZATION_ID,
        businessId: BUSINESS_ID,
        contactId: CONTACT_ID,
        conversationId: CONVERSATION_ID,
        claim: baseClaim(),
      }),
    ).rejects.toThrow("some other failure");
  });

  it("confirms the booking, marks the draft completed, and notifies the technician", async () => {
    tables.set("technicians", {
      id: TECHNICIAN_ID,
      display_name: "Mai",
      wa_id: "49150000001",
    });

    const result = await confirmBookingFromIntent({
      organizationId: ORGANIZATION_ID,
      businessId: BUSINESS_ID,
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      claim: baseClaim({ technicianRef: TECHNICIAN_ID }),
    });

    expect(result).toMatchObject({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      technician: "Mai",
      services: "Manicure",
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        status: "confirmed",
        technicianWaId: "49150000001",
        deduplicationKey: `booking:${BOOKING_ID}:technician:confirmed`,
      }),
    );
  });
});

describe("cancelBookingForContact", () => {
  it("returns not_cancellable when no matching booking exists for this contact", async () => {
    const result = await cancelBookingForContact({
      organizationId: ORGANIZATION_ID,
      contactId: CONTACT_ID,
      bookingId: BOOKING_ID,
    });
    expect(result).toEqual({ outcome: "not_cancellable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns not_cancellable when the RPC reports the booking can no longer be cancelled", async () => {
    tables.set("bookings", {
      id: BOOKING_ID,
      technician_ref: null,
      starts_at: "2099-09-18T15:00:00+07:00",
      salon: { name: "Mitte" },
    });
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    const result = await cancelBookingForContact({
      organizationId: ORGANIZATION_ID,
      contactId: CONTACT_ID,
      bookingId: BOOKING_ID,
    });
    expect(result).toEqual({ outcome: "not_cancellable" });
  });

  it("cancels the booking and queues the technician cancellation notification", async () => {
    tables.set("bookings", {
      id: BOOKING_ID,
      technician_ref: TECHNICIAN_ID,
      starts_at: "2099-09-18T15:00:00+07:00",
      salon: { name: "Mitte" },
    });
    tables.set("technicians", { wa_id: "49150000001" });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await cancelBookingForContact({
      organizationId: ORGANIZATION_ID,
      contactId: CONTACT_ID,
      bookingId: BOOKING_ID,
    });

    expect(result).toEqual({ outcome: "cancelled", bookingId: BOOKING_ID });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        technicianWaId: "49150000001",
        deduplicationKey: `booking:${BOOKING_ID}:technician:cancelled`,
      }),
    );
  });

  it("does not notify when the cancelled booking had no technician assigned", async () => {
    tables.set("bookings", {
      id: BOOKING_ID,
      technician_ref: null,
      starts_at: "2099-09-18T15:00:00+07:00",
      salon: { name: "Mitte" },
    });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await cancelBookingForContact({
      organizationId: ORGANIZATION_ID,
      contactId: CONTACT_ID,
      bookingId: BOOKING_ID,
    });

    expect(result).toEqual({ outcome: "cancelled", bookingId: BOOKING_ID });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
