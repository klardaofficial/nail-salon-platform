import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  selects: [] as string[],
  data: [] as unknown[],
  eqCalls: [] as unknown[][],
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { queryAdminBookings } from "./admin-query";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selects.length = 0;
  mocks.data = [];
  mocks.eqCalls.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    query.select = (selection: string) => {
      if (table === "bookings") mocks.selects.push(selection);
      return query;
    };
    query.eq = (...args: unknown[]) => {
      mocks.eqCalls.push(args);
      return query;
    };
    for (const method of ["gte", "lte", "order", "limit"]) query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: mocks.data, error: null }).then(resolve);
    return query;
  });
});

describe("queryAdminBookings", () => {
  it("accepts the checked_in status filter and passes it through to the query", async () => {
    await queryAdminBookings("org-1", { status: "checked_in" });
    expect(mocks.eqCalls).toContainEqual(["status", "checked_in"]);
  });

  it("surfaces checked_in_at on a checked-in booking row", async () => {
    mocks.data = [
      {
        id: "booking-3",
        status: "checked_in",
        starts_at: "2026-09-20T10:00:00Z",
        local_time_label: "5:00 PM",
        timezone_snapshot: "Asia/Bangkok",
        additional_request: null,
        cancelled_at: null,
        cancellation_reason: null,
        checked_in_at: "2026-09-20T10:05:00Z",
        simulated: false,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-20T10:05:00Z",
        technician_name_snapshot: null,
        salon: null,
        customer: { display_name: "Alex", wa_id: "1234567890" },
        booking_services: [],
      },
    ];
    const [row] = await queryAdminBookings("org-1", {});
    expect(row.status).toBe("checked_in");
    expect(row.checkedInAt).toBe("2026-09-20T10:05:00Z");
  });

  it("requests the narrative and lifecycle columns and keeps composite-FK embed names", async () => {
    await queryAdminBookings("org-1", {});

    const selection = mocks.selects[0];
    expect(selection).toContain("local_time_label");
    expect(selection).toContain("timezone_snapshot");
    expect(selection).toContain("additional_request");
    expect(selection).toContain("cancelled_at");
    expect(selection).toContain("cancellation_reason");
    expect(selection).toContain("checked_in_at");
    expect(selection).toContain("simulated");
    expect(selection).toContain("updated_at");
    expect(selection).toContain("service_id");
    expect(selection).toContain("location_label");
    expect(selection).toContain("salons!bookings_organization_salon_fkey");
    expect(selection).toContain("contacts!bookings_organization_contact_fkey");
    expect(selection).toContain("booking_services!booking_services_organization_booking_fkey");
  });

  it("sorts service details by position and flags entries with no service_id as custom", async () => {
    mocks.data = [
      {
        id: "booking-1",
        status: "confirmed",
        starts_at: "2026-09-20T10:00:00Z",
        local_time_label: "5:00 PM",
        timezone_snapshot: "Asia/Bangkok",
        additional_request: null,
        cancelled_at: null,
        cancellation_reason: null,
        simulated: false,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
        technician_name_snapshot: null,
        salon: { name: "Downtown", location_label: "Downtown mall, 2nd floor" },
        customer: { display_name: "Alex", wa_id: "1234567890" },
        booking_services: [
          { service_name_snapshot: "Gel polish", position: 1, service_id: "svc-1" },
          { service_name_snapshot: "Nail art", position: 0, service_id: null },
        ],
      },
    ];

    const [row] = await queryAdminBookings("org-1", {});

    expect(row.serviceDetails).toEqual([
      { name: "Nail art", position: 0, custom: true },
      { name: "Gel polish", position: 1, custom: false },
    ]);
    expect(row.services).toBe("Nail art, Gel polish");
    expect(row.customerWhatsapp).toBe("1234567890");
    expect(row.salonLocation).toBe("Downtown mall, 2nd floor");
  });

  it("falls back to [N/A] when the salon or services are missing", async () => {
    mocks.data = [
      {
        id: "booking-2",
        status: "cancelled",
        starts_at: "2026-09-20T10:00:00Z",
        local_time_label: "5:00 PM",
        timezone_snapshot: "Asia/Bangkok",
        additional_request: "Please arrive early",
        cancelled_at: "2026-09-19T12:00:00Z",
        cancellation_reason: "Customer requested",
        simulated: true,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T01:00:00Z",
        technician_name_snapshot: null,
        salon: null,
        customer: { display_name: "", wa_id: "1234567890" },
        booking_services: [],
      },
    ];

    const [row] = await queryAdminBookings("org-1", {});

    expect(row.salonName).toBe("[N/A]");
    expect(row.salonLocation).toBe("[N/A]");
    expect(row.services).toBe("[N/A]");
    expect(row.serviceDetails).toEqual([]);
    expect(row.customerName).toBe("1234567890");
    expect(row.additionalRequest).toBe("Please arrive early");
    expect(row.cancellationReason).toBe("Customer requested");
    expect(row.simulated).toBe(true);
  });
});
