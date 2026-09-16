import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticated: true, rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({
  getServerEnv: () => ({ PLATFORM_TIMEZONE: "Europe/Berlin" }),
}));
vi.mock("@/lib/auth/api-admin", () => ({
  requireApiAdmin: async () => ({
    error: mocks.authenticated ? null : new Response(null, { status: 401 }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { GET as activity } from "@/app/api/admin/platform/route";
import { GET as usage } from "@/app/api/admin/ai-usage/route";
import { GET as csv } from "@/app/api/admin/reports/platform.csv/route";
import { GET as inbox } from "@/app/api/admin/inbox/route";
import { GET as messages } from "@/app/api/admin/inbox/messages/route";
import { reportingBounds, reportingQuerySchema } from "./period";
import { platformActivityCsv } from "./platform-csv";
import type { PlatformActivity } from "./platform-types";

const report: Omit<PlatformActivity, "period"> = {
  received: 1501,
  sent: 2002,
  activeUsers: 501,
  ai: [
    {
      kind: "chat_text",
      model: "=synthetic",
      channel: "whatsapp",
      calls: 2,
      failed: 1,
      incomplete: 0,
      missing_usage: 1,
      unpriced_calls: 1,
      input_tokens: 1000,
      cached_input_tokens: 200,
      input_text_tokens: 0,
      input_image_tokens: 0,
      output_tokens: 100,
      images: 0,
      cost: 0.0011,
    },
  ],
  trends: [
    {
      date: "2026-03-29",
      received: 1501,
      sent: 2002,
      activeUsers: 501,
      chatCalls: 2,
      imageCalls: 0,
      chatCost: 0.0011,
      imageCost: 0,
      unpricedCalls: 1,
    },
  ],
};
const params = "from=2026-03-29&to=2026-03-29&channel=all";
const operations: { method: string; args: unknown[] }[] = [];
let rows: unknown[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated = true;
  operations.length = 0;
  rows = [];
  mocks.rpc.mockResolvedValue({ data: report, error: null });
  mocks.from.mockImplementation(() => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "gte", "lt", "eq", "order", "range", "or", "limit"])
      query[method] = (...args: unknown[]) => {
        operations.push({ method, args });
        return query;
      };
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, count: 75, error: null }).then(resolve);
    return query;
  });
});

describe("report boundaries and access", () => {
  it("uses exclusive local-midnight bounds through both DST changes", () => {
    expect(reportingBounds("2026-03-29", "2026-03-29", "Europe/Berlin")).toEqual({
      start: "2026-03-28T23:00:00.000Z",
      end: "2026-03-29T22:00:00.000Z",
    });
    expect(reportingBounds("2026-10-25", "2026-10-25", "Europe/Berlin")).toEqual({
      start: "2026-10-24T22:00:00.000Z",
      end: "2026-10-25T23:00:00.000Z",
    });
    expect(reportingQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(
      false,
    );
    expect(reportingQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success).toBe(
      false,
    );
  });
  it("rejects unauthenticated requests before reading any private data", async () => {
    mocks.authenticated = false;
    for (const handler of [activity, usage, csv, inbox, messages])
      expect((await handler(new Request("http://test/api"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("validates dates, sources, pages, and cursors before querying", async () => {
    expect(
      (await activity(new Request("http://test/api?from=2026-04-01&to=2026-03-01"))).status,
    ).toBe(422);
    expect(
      (await activity(new Request(`http://test/api?${params.replace("all", "other")}`))).status,
    ).toBe(422);
    expect((await usage(new Request(`http://test/api?${params}&page=-1`))).status).toBe(422);
    expect(
      (await messages(new Request("http://test/api?waId=49150000001&cursor=invalid"))).status,
    ).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uses identical uncapped metrics and filters for the API and CSV", async () => {
    const response = await activity(new Request(`http://test/api?${params}`));
    const payload = (await response.json()) as { data: PlatformActivity };
    const download = await csv(new Request(`http://test/api?${params}`));
    expect(payload.data.received).toBe(1501);
    expect(payload.data.activeUsers).toBe(501);
    expect(payload.data.ai[0].unpriced_calls).toBe(1);
    expect(await download.text()).toBe(platformActivityCsv(payload.data).replace(/^\uFEFF/, ""));
    expect(platformActivityCsv(payload.data)).toContain(`"'=synthetic"`);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_platform_activity", {
      p_from: "2026-03-29",
      p_to: "2026-03-29",
      p_timezone: "Europe/Berlin",
      p_channel: "all",
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("paginates AI logs with the same timezone and source filters", async () => {
    const response = await usage(
      new Request(
        `http://test/api?${params.replace("all", "whatsapp_simulator")}&page=2&kind=image_generation`,
      ),
    );
    expect(response.status).toBe(200);
    expect(operations).toEqual(
      expect.arrayContaining([
        { method: "gte", args: ["started_at", "2026-03-28T23:00:00.000Z"] },
        { method: "lt", args: ["started_at", "2026-03-29T22:00:00.000Z"] },
        { method: "eq", args: ["channel", "whatsapp_simulator"] },
        { method: "eq", args: ["kind", "image_generation"] },
        { method: "range", args: [25, 49] },
      ]),
    );
  });
  it("forwards literal search and role filters before thread pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: { conversations: [], total: 45 }, error: null });
    const response = await inbox(
      new Request("http://test/api?channel=whatsapp&search=Test%25&role=owner&page=2"),
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_whatsapp_threads", {
      p_channel: "whatsapp",
      p_search: "Test%",
      p_role: "owner",
      p_offset: 30,
      p_limit: 30,
    });
  });
  it("uses timestamp and ID cursor ties without exposing raw payloads", async () => {
    rows = Array.from({ length: 51 }, (_, index) => ({
      id: `outbound:00000000-0000-4000-8000-${String(51 - index).padStart(12, "0")}`,
      direction: "outbound",
      created_at: "2026-03-29T10:00:00+00:00",
      state: "sent",
      text_content: "Synthetic reply",
      media_id: null,
      payload: { kind: "text", text: "Synthetic reply", privateMetadata: "omit this" },
    }));
    const response = await messages(
      new Request("http://test/api?channel=whatsapp&waId=49150000001"),
    );
    const payload = (await response.json()) as {
      data: { messages: unknown[]; nextCursor: string };
    };
    expect(payload.data.messages).toHaveLength(50);
    expect(JSON.stringify(payload)).not.toContain("privateMetadata");
    const cursor = JSON.parse(payload.data.nextCursor) as { at: string; id: string };
    expect(cursor.id).toBe("outbound:00000000-0000-4000-8000-000000000002");
    await messages(
      new Request(
        `http://test/api?channel=whatsapp&waId=49150000001&cursor=${encodeURIComponent(payload.data.nextCursor)}`,
      ),
    );
    expect(operations).toContainEqual({
      method: "or",
      args: [`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`],
    });
    expect(operations).toContainEqual({ method: "eq", args: ["channel", "whatsapp"] });
  });
  it("surfaces database failures instead of reporting zero activity", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("Reporting unavailable"), data: null });
    expect((await activity(new Request(`http://test/api?${params}`))).status).toBe(500);
  });
});
