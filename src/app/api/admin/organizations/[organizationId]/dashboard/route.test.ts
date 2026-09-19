import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  bookingSelects: [] as string[],
  bookingsData: [] as unknown[],
}));

vi.mock("@/lib/auth/api-admin", () => ({
  requireOrganizationAdmin: async () => ({ admin: { id: "admin" }, error: null }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bookingSelects.length = 0;
  mocks.bookingsData = [];
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    query.select = (selection: string) => {
      if (table === "bookings") mocks.bookingSelects.push(selection);
      return query;
    };
    for (const method of ["eq", "gte", "lt", "order", "in", "single"]) query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        table === "organization_settings"
          ? { data: { platform_timezone: "Asia/Bangkok", simulator_enabled: true }, error: null }
          : table === "bookings"
            ? { data: mocks.bookingsData, error: null, count: mocks.bookingsData.length }
            : { data: [], error: null, count: 0 },
      ).then(resolve);
    return query;
  });
});

function request() {
  return new Request(
    "http://localhost/api/admin/organizations/00000000-0000-4000-8000-000000000101/dashboard?from=2026-09-01&to=2026-09-17&source=real",
  );
}

const params = Promise.resolve({ organizationId: "00000000-0000-4000-8000-000000000101" });

describe("organization dashboard route", () => {
  it("uses the tenant-composite customer relationship for embedded rows", async () => {
    const response = await GET(request(), { params });

    expect(response.status).toBe(200);
    expect(mocks.bookingSelects[0]).toContain("contacts!bookings_organization_contact_fkey");
    expect(mocks.bookingSelects[0]).not.toContain("salons!bookings_organization_salon_fkey");
  });

  it("shows the customer's name (falling back to their WhatsApp number) and always carries the number", async () => {
    mocks.bookingsData = [
      {
        id: "booking-1",
        contact_id: "contact-1",
        created_at: "2026-09-10T00:00:00Z",
        starts_at: "2026-09-11T00:00:00Z",
        status: "confirmed",
        simulated: false,
        customer: { display_name: "Alex", wa_id: "1234567890" },
      },
      {
        id: "booking-2",
        contact_id: "contact-2",
        created_at: "2026-09-10T00:00:00Z",
        starts_at: "2026-09-11T00:00:00Z",
        status: "confirmed",
        simulated: false,
        customer: { display_name: "", wa_id: "1234567891" },
      },
    ];

    const response = await GET(request(), { params });
    const body = await response.json();

    expect(body.data.recentBookings).toEqual([
      expect.objectContaining({ customerName: "Alex", customerWhatsapp: "1234567890" }),
      expect.objectContaining({ customerName: "1234567891", customerWhatsapp: "1234567891" }),
    ]);
  });
});
