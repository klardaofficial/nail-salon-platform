import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/auth/api-admin", () => ({
  requireApiAdmin: async () => ({
    admin: { id: "admin", isSystemAdmin: true, organizationIds: [] },
    error: null,
  }),
  requireSystemAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation(() => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "in"]) query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000101",
            name: "Enabled organization",
            status: "active",
            created_at: "2026-09-18T00:00:00.000Z",
            businesses: { name: "Enabled organization" },
            settings: { simulator_enabled: true },
          },
          {
            id: "00000000-0000-4000-8000-000000000102",
            name: "Array-shaped organization",
            status: "active",
            created_at: "2026-09-18T00:00:00.000Z",
            businesses: [{ name: "Array-shaped organization" }],
            settings: [{ simulator_enabled: true }],
          },
        ],
        count: 2,
        error: null,
      }).then(resolve);
    return query;
  });
});

describe("organizations route", () => {
  it("returns the simulator flag from the one-to-one settings relation without caching", async () => {
    const response = await GET(new Request("http://localhost/api/admin/organizations?limit=500"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload.data.organizations[0].simulatorEnabled).toBe(true);
    expect(payload.data.organizations[1].simulatorEnabled).toBe(true);
  });
});
