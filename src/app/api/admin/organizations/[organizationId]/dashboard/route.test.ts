import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), bookingSelects: [] as string[] }));

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
          ? {
              data: { platform_timezone: "Asia/Bangkok", simulator_enabled: true },
              error: null,
            }
          : { data: [], error: null, count: 0 },
      ).then(resolve);
    return query;
  });
});

describe("organization dashboard route", () => {
  it("uses tenant-composite booking relationships for embedded rows", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/organizations/00000000-0000-4000-8000-000000000101/dashboard?from=2026-09-01&to=2026-09-17&source=real",
      ),
      { params: Promise.resolve({ organizationId: "00000000-0000-4000-8000-000000000101" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.bookingSelects[0]).toContain("salons!bookings_organization_salon_fkey");
    expect(mocks.bookingSelects[0]).toContain("contacts!bookings_organization_contact_fkey");
  });
});
