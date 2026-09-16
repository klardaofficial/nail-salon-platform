import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: true, update: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-admin", () => ({
  requireApiAdmin: async () => ({
    admin: { id: "admin" },
    error: mocks.authorized ? null : new Response(null, { status: 401 }),
  }),
}));
vi.mock("@/lib/config/env", () => ({ getBotLocale: () => "vi", getServerEnv: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { GET, PATCH } from "./route";
import { queryAdminBookings } from "@/features/bookings/admin-query";

const values = {
  platformTimezone: "Asia/Bangkok",
  defaultOpenTime: "09:00",
  defaultCloseTime: "18:00",
  defaultBookingIntervalMinutes: 30,
  previewRequestsPerDay: 3,
  previewsPerRequest: 3,
  technicianBookingConfirmedTemplate: null,
  technicianBookingCancelledTemplate: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  mocks.from.mockImplementation((table: string) => {
    const data =
      table === "bookings"
        ? [
            {
              id: "booking",
              salon: null,
              customer: { wa_id: "49151111111" },
              booking_services: [],
              technician_name_snapshot: null,
            },
          ]
        : {
            platform_timezone: "Asia/Bangkok",
            default_open_time: "09:00",
            default_close_time: "18:00",
          };
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "single", "insert", "order", "limit"])
      query[method] = () => query;
    query.update = (value: unknown) => {
      mocks.update(value);
      return query;
    };
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve);
    return query;
  });
});

describe("settings without greeting configuration", () => {
  it("accepts saving without greeting fields and does not write legacy greeting values", async () => {
    const result = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ ...values, greetingEn: "obsolete", greetingDe: "obsolete" }),
      }),
    );
    expect(result.status).toBe(200);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("greeting_en");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("greeting_de");
    const response = await (await GET()).json();
    expect(JSON.stringify(response)).toContain('"botLocale":"vi"');
    expect(JSON.stringify(response)).not.toContain("greetingEn");
    const withoutLegacy = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    );
    expect(withoutLegacy.status).toBe(200);
  });
  it("requires an authenticated admin for reads and writes", async () => {
    mocks.authorized = false;
    expect((await GET()).status).toBe(401);
    expect(
      (
        await PATCH(
          new Request("http://localhost", { method: "PATCH", body: JSON.stringify(values) }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("shows placeholders for bookings with no salon or services while retaining nullable technician data", async () => {
    expect((await queryAdminBookings({}))[0]).toMatchObject({
      salonName: "[N/A]",
      services: "[N/A]",
      technicianName: null,
    });
  });
});
