import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ from: vi.fn(), data: [] as unknown[] }));

vi.mock("@/lib/auth/api-admin", () => ({
  requireOrganizationAdmin: async () => ({ admin: { id: "admin" }, error: null }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = [];
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "order", "limit"])
      query[method] = () => query;
    query.single = () => Promise.resolve({ data: { simulator_enabled: true }, error: null });
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        table === "bookings" ? { data: mocks.data, error: null } : { data: [], error: null },
      ).then(resolve);
    return query;
  });
});

function withoutBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function request(query = "") {
  return new Request(
    `http://localhost/api/admin/organizations/00000000-0000-4000-8000-000000000101/reports/bookings.csv${query}`,
  );
}

const params = Promise.resolve({ organizationId: "00000000-0000-4000-8000-000000000101" });

describe("bookings CSV export route", () => {
  it("emits the 17-column header in the documented order", async () => {
    const response = await GET(request(), { params });
    const text = await response.text();
    const [header] = withoutBom(text).split("\r\n");

    expect(header).toBe(
      [
        "Reference",
        "Customer",
        "Customer WhatsApp",
        "Salon",
        "Salon location",
        "Services",
        "Technician",
        "Starts at",
        "Booked local time",
        "Timezone",
        "Additional request",
        "Status",
        "Cancelled at",
        "Cancellation reason",
        "Source",
        "Created at",
        "Updated at",
      ]
        .map((title) => `"${title}"`)
        .join(","),
    );
  });

  it("emits one row per booking and escapes a formula-like additional request", async () => {
    mocks.data = [
      {
        id: "booking-1",
        status: "confirmed",
        starts_at: "2026-09-20T10:00:00Z",
        local_time_label: "5:00 PM",
        timezone_snapshot: "Asia/Bangkok",
        additional_request: "=SUM(A1)",
        cancelled_at: null,
        cancellation_reason: null,
        simulated: false,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
        technician_name_snapshot: "Jamie",
        salon: { name: "Downtown", location_label: "Downtown mall, 2nd floor" },
        customer: { display_name: "Alex", wa_id: "1234567890" },
        booking_services: [{ service_name_snapshot: "Gel polish", position: 0, service_id: null }],
      },
      {
        id: "booking-2",
        status: "cancelled",
        starts_at: "2026-09-21T10:00:00Z",
        local_time_label: "5:00 PM",
        timezone_snapshot: "Asia/Bangkok",
        additional_request: null,
        cancelled_at: "2026-09-19T12:00:00Z",
        cancellation_reason: "Customer requested",
        simulated: true,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
        technician_name_snapshot: null,
        salon: { name: "Uptown", location_label: "Uptown plaza" },
        customer: { display_name: "Sam", wa_id: "1234567891" },
        booking_services: [],
      },
    ];

    const response = await GET(request(), { params });
    const text = await response.text();
    const lines = withoutBom(text).split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(`"'=SUM(A1)"`);
    expect(lines[1]).toContain(`"Gel polish (custom)"`);
    expect(lines[1]).toContain(`"1234567890"`);
    expect(lines[1]).toContain(`"Downtown mall, 2nd floor"`);
    expect(lines[2]).toContain(`"Simulator"`);
    expect(lines[2]).toContain(`"Customer requested"`);
    expect(lines[2]).toContain(`"Uptown plaza"`);
  });
});
