import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type QueuedMessageInput = {
  organizationId: string;
  conversationId?: string | null;
  transport?: "whatsapp" | "simulator";
  recipientWaId: string;
  payload: { kind: "template"; name: string; languageCode: string; bodyParameters: string[] };
  deduplicationKey: string;
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queueWhatsAppMessage: vi.fn(async (_input: QueuedMessageInput) => "outbox-id"),
  resolveEffectiveMetaConfiguration: vi.fn(),
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  rules: [] as Array<{ organization_id: string; offset_minutes: number }>,
  bookings: [] as unknown[],
  conversation: null as unknown,
  settings: { bot_locale: "en" } as unknown,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/features/messaging/outbox", () => ({
  queueWhatsAppMessage: mocks.queueWhatsAppMessage,
}));
vi.mock("@/features/organizations/providers", () => ({
  resolveEffectiveMetaConfiguration: mocks.resolveEffectiveMetaConfiguration,
}));

import { queueDueBookingReminders } from "./reminder-delivery";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000202";

// One chainable, thenable query builder per table. reminder-delivery.ts never
// calls order/limit, but the extra methods are harmless no-ops kept for
// parity with the admin-query.test.ts stub this is modelled on. Assertions
// about *which* filters were applied (status = confirmed, the simulator
// channel, etc.) read `mocks.calls` rather than actually filtering `data`,
// matching the existing precedent in admin-query.test.ts.
function tableResult(table: string): { data: unknown; error: null } {
  switch (table) {
    case "booking_reminder_rules":
      return { data: mocks.rules, error: null };
    case "bookings":
      return { data: mocks.bookings, error: null };
    case "conversations":
      return { data: mocks.conversation, error: null };
    case "organization_settings":
      return { data: mocks.settings, error: null };
    default:
      throw new Error(`unexpected table ${table}`);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.rules = [];
  mocks.bookings = [];
  mocks.conversation = null;
  mocks.settings = { bot_locale: "en" };
  mocks.resolveEffectiveMetaConfiguration.mockResolvedValue(null);

  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "order", "limit", "in"]) {
      query[method] = (...args: unknown[]) => {
        mocks.calls.push({ table, method, args });
        return query;
      };
    }
    query.maybeSingle = async () => tableResult(table);
    query.single = async () => tableResult(table);
    query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(tableResult(table)).then(resolve, reject);
    return query;
  });
});

function seedSingleBookingScenario(options: { simulated?: boolean } = {}) {
  mocks.rules = [{ organization_id: ORGANIZATION_ID, offset_minutes: 60 }];
  mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
    templates: { reminder: { name: "reminder_tmpl", source: "organization" } },
  });
  mocks.bookings = [
    {
      id: "booking-1",
      starts_at: "2026-09-22T10:00:00Z",
      local_time_label: "5:00 PM",
      simulated: options.simulated ?? false,
      customer: { display_name: "Alex", wa_id: "1234567890" },
    },
  ];
  mocks.conversation = { id: "conv-1", reply_locale: "en" };
}

describe("queueDueBookingReminders", () => {
  it("queues one templated reminder per booking per offset, keyed by booking+offset", async () => {
    seedSingleBookingScenario();

    const result = await queueDueBookingReminders();

    expect(result).toEqual({ organizations: 1, queued: 1 });
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      conversationId: "conv-1",
      transport: "whatsapp",
      recipientWaId: "1234567890",
      payload: {
        kind: "template",
        name: "reminder_tmpl",
        languageCode: "en_US",
        bodyParameters: ["Alex", "5:00 PM"],
      },
      deduplicationKey: "booking:booking-1:reminder:60",
    });
  });

  it("sends nothing when no reminder template resolves at either level, and never scans bookings", async () => {
    mocks.rules = [{ organization_id: ORGANIZATION_ID, offset_minutes: 60 }];
    mocks.resolveEffectiveMetaConfiguration.mockResolvedValue({
      templates: { reminder: { name: null, source: "none" } },
    });
    mocks.bookings = [
      {
        id: "booking-1",
        starts_at: "2026-09-22T10:00:00Z",
        local_time_label: "5:00 PM",
        simulated: false,
        customer: { display_name: "Alex", wa_id: "1234567890" },
      },
    ];

    const result = await queueDueBookingReminders();

    expect(result).toEqual({ organizations: 1, queued: 0 });
    expect(mocks.queueWhatsAppMessage).not.toHaveBeenCalled();
    expect(mocks.calls.some((call) => call.table === "bookings")).toBe(false);
  });

  it("resolves each organization's own template, preferring it, and still honors a root-inherited template for another organization", async () => {
    mocks.rules = [
      { organization_id: ORGANIZATION_ID, offset_minutes: 60 },
      { organization_id: OTHER_ORGANIZATION_ID, offset_minutes: 60 },
    ];
    mocks.resolveEffectiveMetaConfiguration.mockImplementation(async (organizationId: string) =>
      organizationId === ORGANIZATION_ID
        ? { templates: { reminder: { name: "org_tmpl", source: "organization" } } }
        : { templates: { reminder: { name: "root_tmpl", source: "root" } } },
    );
    mocks.bookings = [
      {
        id: "booking-1",
        starts_at: "2026-09-22T10:00:00Z",
        local_time_label: "5:00 PM",
        simulated: false,
        customer: { display_name: "Alex", wa_id: "1234567890" },
      },
    ];
    mocks.conversation = { id: "conv-1", reply_locale: "en" };

    await queueDueBookingReminders();

    const templateNamesUsed = mocks.queueWhatsAppMessage.mock.calls.map(
      ([input]) => input.payload.name,
    );
    expect(templateNamesUsed.sort()).toEqual(["org_tmpl", "root_tmpl"]);
  });

  it("never queries bookings when the organization has no reminder rules", async () => {
    mocks.rules = [];

    const result = await queueDueBookingReminders();

    expect(result).toEqual({ organizations: 0, queued: 0 });
    expect(mocks.resolveEffectiveMetaConfiguration).not.toHaveBeenCalled();
    expect(mocks.calls.some((call) => call.table === "bookings")).toBe(false);
    expect(mocks.queueWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("routes a simulated booking's reminder through the simulator transport and channel", async () => {
    seedSingleBookingScenario({ simulated: true });

    await queueDueBookingReminders();

    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ transport: "simulator" }),
    );
    expect(mocks.calls).toContainEqual({
      table: "conversations",
      method: "eq",
      args: ["channel", "whatsapp_simulator"],
    });
  });

  it("only ever queries confirmed bookings, excluding cancelled and checked_in", async () => {
    seedSingleBookingScenario();
    mocks.bookings = [];

    await queueDueBookingReminders();

    expect(mocks.calls).toContainEqual({
      table: "bookings",
      method: "eq",
      args: ["status", "confirmed"],
    });
  });

  // queueWhatsAppMessage itself is what makes redelivery a no-op (a durable
  // upsert with `ignoreDuplicates: true` against message_outbox's unique
  // (organization_id, deduplication_key)); this proves reminder-delivery.ts
  // hands it byte-identical input on every tick, which is what makes relying
  // on that no-op safe.
  it("replays byte-identical input on a second tick, which is what lets ignoreDuplicates no-op the resend", async () => {
    seedSingleBookingScenario();

    await queueDueBookingReminders();
    await queueDueBookingReminders();

    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledTimes(2);
    const [firstCall] = mocks.queueWhatsAppMessage.mock.calls[0];
    const [secondCall] = mocks.queueWhatsAppMessage.mock.calls[1];
    expect(secondCall).toEqual(firstCall);
  });
});
