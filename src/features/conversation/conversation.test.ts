import { beforeEach, describe, expect, it, vi } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  response: vi.fn(),
  queue: vi.fn(),
  configured: true,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/config/env", () => ({
  getBotLocale: () => "de",
  getServerEnv: () => ({ BOT_LOCALE: "de", OPENAI_CHAT_MODEL: "test" }),
}));
vi.mock("@/integrations/openai/client", () => ({
  hasOpenAIConfig: () => mocks.configured,
  getOpenAIClient: () => ({ responses: { create: mocks.response } }),
}));
vi.mock("@/features/ai-usage/record", () => ({
  summarizeChatUsage: vi.fn(),
  withAIUsage: (_context: unknown, request: () => Promise<unknown>) => request(),
}));
vi.mock("@/features/messaging/outbox", () => ({ queueWhatsAppMessage: mocks.queue }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { languageCodeSchema } from "@/lib/bot/language";
import { createNaturalReply } from "./respond";
import { naturalReplySchema, parseNaturalReply } from "./reply";
import { executeConversationTool, type ConversationActor } from "./tools";
import { toolsForActor } from "./tools";
import { createLocalizedText } from "./localize";
import { recipientLocale, templateLanguageCode } from "./notifications";

const tables = new Map<string, unknown>();
const operations: { table: string; method: string; args: unknown[] }[] = [];
const actor: ConversationActor = {
  conversationId: "conversation",
  contactId: "contact",
  waId: "49151111111",
  isOwner: false,
  technicianIds: [],
  currentMediaId: null,
  transport: "simulator",
  locale: "th",
};
const salonId = "6fcb66a0-d713-4bfc-a075-0e7d3864bafd";
const technicianId = "6fcb66a0-d713-4bfc-a075-0e7d3864bafe";
const reply = {
  locale: "vi",
  text: "Bạn muốn đặt lịch lúc nào?",
  unavailableText: "Vui lòng thử lại sau.",
  buttonLabel: "Chọn",
  sectionTitle: "Lựa chọn",
  options: [{ id: "reply:tomorrow", title: "Ngày mai", description: null }],
};
const booking = {
  salonId: null,
  startsAt: "2099-09-18T15:00:00+07:00",
  services: [],
  technicianRef: null,
  additionalRequest: null,
};
const salon = {
  id: salonId,
  business_id: "business",
  name: "Mitte",
  timezone: "Europe/Berlin",
  booking_interval_minutes: 45,
  services: [],
  technicians: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  tables.clear();
  operations.length = 0;
  tables.set("businesses", { id: "business", name: "Nails", active: true });
  tables.set("platform_settings", { platform_timezone: "Asia/Bangkok" });
  tables.set("salons", []);
  tables.set("booking_drafts", null);
  tables.set("tool_executions", null);
  tables.set("conversation_messages", [
    {
      direction: "inbound",
      text_content: "Xin chào",
      message_type: "text",
      structured_content: {},
    },
  ]);
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "is",
      "in",
      "not",
      "order",
      "limit",
      "upsert",
      "update",
      "insert",
      "single",
      "maybeSingle",
      "gte",
      "lte",
      "range",
    ])
      query[method] = (...args: unknown[]) => {
        operations.push({ table, method, args });
        return query;
      };
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: tables.get(table) ?? null,
        count: table === "bookings" ? 21 : null,
        error: null,
      }).then(resolve);
    return query;
  });
  mocks.rpc.mockResolvedValue({ data: "booking-id", error: null });
  mocks.response.mockResolvedValue({ output: [], output_text: JSON.stringify(reply) });
});

async function create(values: Record<string, unknown> = {}) {
  return executeConversationTool(actor, {
    type: "function_call",
    name: "create_booking",
    call_id: "call",
    arguments: JSON.stringify({ ...booking, ...values }),
  });
}

async function update(values: Record<string, unknown> = {}) {
  return executeConversationTool(actor, {
    type: "function_call",
    name: "update_booking",
    call_id: "update-call",
    arguments: JSON.stringify({
      bookingId: salonId,
      salonId: null,
      startsAt: booking.startsAt,
      services: [],
      technicianRef: null,
      additionalRequest: null,
      ...values,
    }),
  });
}

describe("unrestricted language and generated controls", () => {
  it.each(["vi", "th", "ja", "ar", "fr-CA", "zh-Hant", "en_US"])(
    "accepts language %s for environment defaults and replies",
    (locale) => {
      expect(languageCodeSchema.parse(locale)).toBe(locale.replace("_", "-"));
      expect(parseNaturalReply(JSON.stringify({ ...reply, locale }))?.locale).toBe(
        locale.replace("_", "-"),
      );
    },
  );
  it("rejects invalid codes, duplicate options, and oversized provider labels", () => {
    expect(languageCodeSchema.safeParse("not a language").success).toBe(false);
    expect(parseNaturalReply("not JSON")).toBeNull();
    expect(
      parseNaturalReply(
        JSON.stringify({ ...reply, options: [reply.options[0], reply.options[0]] }),
      ),
    ).toBeNull();
    expect(
      parseNaturalReply(
        JSON.stringify({ ...reply, options: [{ ...reply.options[0], title: "a".repeat(21) }] }),
      ),
    ).toBeNull();
    expect(
      parseNaturalReply(
        JSON.stringify({
          ...reply,
          options: Array.from({ length: 11 }, (_, i) => ({ ...reply.options[0], id: String(i) })),
        }),
      ),
    ).toBeNull();
    const format = zodTextFormat(naturalReplySchema, "whatsapp_reply");
    expect(format).toMatchObject({ type: "json_schema", strict: true });
  });
  it("sends the greeting to AI once with platform timezone and returns its wording and labels unchanged", async () => {
    expect(await createNaturalReply(actor)).toEqual(reply);
    const request = mocks.response.mock.calls[0][0];
    expect(request).toMatchObject({
      store: false,
      parallel_tool_calls: false,
      text: { format: { type: "json_schema" } },
    });
    expect(request.instructions).toContain("There is no language allowlist");
    expect(request.instructions).toContain("current conversation language is th");
    expect(request.instructions).toContain("at most ONE focused question");
    expect(request.instructions).toContain("platform timezone Asia/Bangkok");
    expect(request.instructions).toContain("salonId=null");
    expect(request.input[0].content).toContain("Xin chào");
    expect(operations).toContainEqual({
      table: "booking_drafts",
      method: "eq",
      args: ["state", "collecting"],
    });
  });
  it("retains interactive titles and IDs together without replacing customer text with English", async () => {
    tables.set("conversation_messages", [
      {
        direction: "inbound",
        text_content: "Ngày mai",
        message_type: "interactive",
        structured_content: { interactiveId: "reply:tomorrow", interactiveTitle: "Ngày mai" },
      },
    ]);
    await createNaturalReply(actor);
    const content = JSON.parse(mocks.response.mock.calls[0][0].input[0].content);
    expect(content).toMatchObject({
      text: "Ngày mai",
      interaction: { interactiveId: "reply:tomorrow" },
    });
  });
  it("filters inactive and deleted catalog entries from suggestions", async () => {
    tables.set("salons", [
      {
        ...salon,
        technicians: [{ id: "gone", active: true, deleted_at: "2026-01-01" }],
      },
    ]);
    tables.set("services", [
      { id: "live", name: "Gel", active: true, deleted_at: null, service_salons: [] },
      { id: "hidden", name: "Hidden", active: false, deleted_at: null, service_salons: [] },
    ]);
    await createNaturalReply(actor);
    const instructions = mocks.response.mock.calls[0][0].instructions;
    const catalog = JSON.parse(instructions.split("Active catalog JSON: ")[1].split("\n")[0]);
    expect(catalog[0].services).toEqual([{ id: "live", name: "Gel" }]);
    expect(catalog[0].technicians).toEqual([]);
    expect(catalog[0].suggestedIntervalMinutes).toBe(45);
    const columns = operations.find(
      (operation) => operation.table === "salons" && operation.method === "select",
    )?.args[0] as string;
    expect(columns.split(",")).toContain("booking_interval_minutes");
    expect(columns.split(",")).not.toContain("default_booking_interval_minutes");
  });
  it("uses the recipient language for supporting messages and handles unavailable AI", async () => {
    tables.set("conversations", { reply_locale: "ja" });
    expect(await recipientLocale("49151111111", "simulator")).toBe("ja");
    mocks.response.mockResolvedValue({ output_text: "予約が確定しました。" });
    expect(await createLocalizedText({ locale: "ja", task: "Confirm booking", details: {} })).toBe(
      "予約が確定しました。",
    );
    expect(mocks.response.mock.calls[0][0].instructions).toContain("language ja");
    expect(mocks.response.mock.calls[0][0].instructions).toContain(
      "without timezone names, abbreviations, UTC/GMT offsets",
    );
    mocks.configured = false;
    expect(await createNaturalReply(actor)).toBeNull();
    expect(
      await createLocalizedText({ locale: "ja", task: "Confirm booking", details: {} }),
    ).toBeNull();
    expect(templateLanguageCode("pt-BR")).toBe("pt_BR");
  });
  it("keeps timezone interpretation internal and independent of salon, draft and conversation language", async () => {
    tables.set("salons", [salon]);
    tables.set("booking_drafts", { ...booking, timezone: "America/New_York" });
    await createNaturalReply(actor);
    const { instructions } = mocks.response.mock.calls[0][0];
    expect(instructions).toContain("configured platform timezone Asia/Bangkok");
    expect(instructions).toContain("Never ask for, infer, or use the person's actual timezone");
    expect(instructions).toContain("without timezone names, abbreviations, UTC/GMT offsets");
    expect(instructions).toContain("every visible message and option label");
    expect(instructions).toContain("Never disclose the configured timezone");
    expect(instructions).not.toContain("Europe/Berlin");
    expect(instructions).not.toContain("America/New_York");
  });
});

describe("minimal booking conditions", () => {
  it("books under the active business without a salon, services or technician, using the platform timezone", async () => {
    const result = await create();
    expect(result).toMatchObject({
      ok: true,
      status: "confirmed",
      startsAt: "2099-09-18 15:00",
    });
    expect(result).not.toHaveProperty("salon");
    expect(result).not.toHaveProperty("technician");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_booking_from_conversation",
      expect.objectContaining({
        p_business_id: "business",
        p_salon_id: null,
        p_technician_ref: null,
        p_services: [],
        p_starts_at: "2099-09-18T08:00:00.000Z",
        p_timezone_snapshot: "Asia/Bangkok",
        p_local_time_label: "2099-09-18 15:00",
      }),
    );
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("keeps a salon optional even when one is active", async () => {
    tables.set("salons", [salon]);
    expect(await create()).toMatchObject({
      ok: true,
      startsAt: "2099-09-18 15:00",
    });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_salon_id: null,
      p_timezone_snapshot: "Asia/Bangkok",
      p_local_time_label: "2099-09-18 15:00",
    });
  });
  it("instructs the AI to offer an optional salon before salon-scoped technician choices", async () => {
    tables.set("salons", [salon]);
    await createNaturalReply(actor);
    const { instructions } = mocks.response.mock.calls[0][0];
    expect(instructions).toContain("offer the salon choices and a No preference option");
    expect(instructions).toContain("Only after a salon is selected");
    expect(instructions).toContain("Do not mention salon or technician when either is absent");
  });
  it("keeps a salon optional when multiple are active", async () => {
    tables.set("salons", [salon, { ...salon, id: technicianId }]);
    expect(await create()).toMatchObject({ ok: true });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_salon_id: null });
    expect(await create({ salonId })).toMatchObject({ ok: true });
  });
  it("rejects an inactive or stale selected salon without inventing a replacement", async () => {
    expect(await create({ salonId })).toMatchObject({ ok: false, error: "salon_is_not_active" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects inactive business and past times", async () => {
    expect(await create({ startsAt: "2000-01-01T12:00:00Z" })).toMatchObject({
      ok: false,
      error: "booking_time_must_be_in_future",
    });
    tables.set("businesses", { id: "business", active: false });
    expect(await create()).toMatchObject({ ok: false, error: "business_is_not_active" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves custom services and unresolved soft technician references", async () => {
    tables.set("salons", [salon]);
    expect(
      await create({
        technicianRef: technicianId,
        services: [{ serviceId: null, name: "Custom art" }],
        additionalRequest: "Simple design",
      }),
    ).toMatchObject({ ok: true });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_technician_ref: technicianId,
      p_technician_name_snapshot: null,
      p_services: [{ serviceId: null, name: "Custom art" }],
      p_additional_request: "Simple design",
    });
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("uses global or selected-salon service IDs but records other customer services as custom", async () => {
    tables.set("salons", [salon]);
    tables.set("services", [
      { id: technicianId, name: "Global manicure", service_salons: [] },
      {
        id: "6fcb66a0-d713-4bfc-a075-0e7d3864baff",
        name: "Other location only",
        service_salons: [{ salon_id: "6fcb66a0-d713-4bfc-a075-0e7d3864baff" }],
      },
    ]);
    await create({
      salonId,
      services: [
        { serviceId: technicianId, name: "Wrong global name" },
        {
          serviceId: "6fcb66a0-d713-4bfc-a075-0e7d3864baff",
          name: "Customer requested service",
        },
      ],
    });
    expect(mocks.rpc.mock.calls[0][1].p_services).toEqual([
      { serviceId: technicianId, name: "Global manicure" },
      { serviceId: null, name: "Customer requested service" },
    ]);
  });
  it("reuses a completed tool result without creating a second booking", async () => {
    tables.set("tool_executions", {
      state: "completed",
      result: { ok: true, bookingId: "existing" },
    });
    expect(await create()).toEqual({ ok: true, bookingId: "existing" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("updates a customer's future booking in place with location, service, technician, and request changes", async () => {
    tables.set("bookings", {
      id: salonId,
      starts_at: "2099-09-18T08:00:00Z",
      business_id: "business",
    });
    tables.set("salons", [salon]);
    tables.set("technicians", {
      display_name: "Mai",
      salon_id: salonId,
      active: true,
    });
    tables.set("services", {
      id: technicianId,
      name: "Manicure",
      service_salons: [{ salon_id: salonId }],
    });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    expect(
      await update({
        salonId,
        technicianRef: technicianId,
        services: [{ serviceId: technicianId, name: "Old name" }],
        additionalRequest: "Glossy finish",
      }),
    ).toMatchObject({
      ok: true,
      bookingId: salonId,
      status: "rescheduled",
      salon: "Mitte",
      technician: "Mai",
      services: [{ serviceId: technicianId, name: "Manicure" }],
      additionalRequest: "Glossy finish",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "reschedule_customer_booking",
      expect.objectContaining({
        p_booking_id: salonId,
        p_salon_id: salonId,
        p_technician_ref: technicianId,
        p_technician_name_snapshot: "Mai",
        p_services: [{ serviceId: technicianId, name: "Manicure" }],
        p_additional_request: "Glossy finish",
      }),
    );
  });
});

describe("staff conversations and authorization", () => {
  it.each([
    [{ ...actor, isOwner: true }, "owner-assistance mode", "owner_list_bookings"],
    [
      { ...actor, technicianIds: [technicianId] },
      "technician-assistance mode",
      "technician_list_bookings",
    ],
  ] as const)("introduces the stored role's capabilities", async (staff, instruction, tool) => {
    await createNaturalReply({ ...staff, technicianIds: [...staff.technicianIds] });
    expect(mocks.response.mock.calls[0][0].instructions).toContain(instruction);
    expect(
      mocks.response.mock.calls[0][0].tools.map((item: { name: string }) => item.name),
    ).toContain(tool);
    expect(mocks.response.mock.calls[0][0].instructions).toContain(
      "unless they explicitly want a personal booking",
    );
    expect(toolsForActor(actor).map((item) => item.name)).not.toContain(tool);
  });

  it("rechecks owner membership and scopes/paginates the actual booking list", async () => {
    const call = {
      type: "function_call" as const,
      name: "owner_list_bookings",
      call_id: "owner-call",
      arguments: JSON.stringify({ from: null, to: null, status: "confirmed", offset: 0 }),
    };
    expect(await executeConversationTool({ ...actor, isOwner: true }, call)).toMatchObject({
      ok: false,
      error: "not_authorized",
    });
    tables.set("business_owners", { business_id: "business" });
    tables.set("bookings", [
      { id: "booking", starts_at: booking.startsAt, salon: null, technician_name_snapshot: null },
    ]);
    expect(await executeConversationTool({ ...actor, isOwner: true }, call)).toMatchObject({
      ok: true,
      total: 21,
      nextOffset: 20,
      bookings: [{ id: "booking" }],
    });
    expect(operations).toContainEqual({
      table: "business_owners",
      method: "eq",
      args: ["contact_id", actor.contactId],
    });
    expect(operations).toContainEqual({
      table: "bookings",
      method: "eq",
      args: ["business_id", "business"],
    });
    expect(operations).toContainEqual({ table: "bookings", method: "range", args: [0, 19] });
  });

  it("uses only current stored technician mappings, rejecting revoked roles", async () => {
    const call = {
      type: "function_call" as const,
      name: "technician_list_bookings",
      call_id: "tech-call",
      arguments: "{}",
    };
    const staff = { ...actor, technicianIds: [technicianId] };
    expect(await executeConversationTool(staff, call)).toMatchObject({
      ok: false,
      error: "not_authorized",
    });
    tables.set("technicians", [{ id: technicianId }]);
    tables.set("bookings", []);
    expect(await executeConversationTool(staff, call)).toMatchObject({ ok: true, bookings: [] });
    expect(operations).toContainEqual({
      table: "technicians",
      method: "eq",
      args: ["wa_id", actor.waId],
    });
    expect(operations).toContainEqual({
      table: "bookings",
      method: "in",
      args: ["technician_ref", [technicianId]],
    });
  });

  it("keeps a successful booking receipt if the final AI round fails", async () => {
    mocks.response
      .mockResolvedValueOnce({
        output: [
          {
            type: "function_call",
            name: "create_booking",
            call_id: "call",
            arguments: JSON.stringify(booking),
          },
        ],
        output_text: "",
      })
      .mockRejectedValueOnce(new Error("provider unavailable"));
    expect(await createNaturalReply(actor)).toMatchObject({
      text: "✅ booking-id\n2099-09-18 15:00",
      options: [],
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["owner", "technician"] as const)(
    "queries complete %s summaries with verified scope and explicit date basis",
    async (role) => {
      tables.set("business_owners", { business_id: "business" });
      tables.set("technicians", [{ id: technicianId }]);
      const summary = { total: 2500, confirmed: 2300, cancelled: 200, customers: 1700 };
      mocks.rpc.mockResolvedValue({ data: summary, error: null });
      const result = await executeConversationTool(actor, {
        type: "function_call",
        name: `${role}_booking_summary`,
        call_id: "summary-call",
        arguments: JSON.stringify({
          from: "2099-09-01T00:00:00+07:00",
          to: "2099-10-01T00:00:00+07:00",
          dateBasis: "appointment",
        }),
      });
      expect(result).toEqual({ ok: true, summary });
      expect(mocks.rpc).toHaveBeenCalledWith("get_staff_booking_summary", {
        p_contact_id: actor.contactId,
        p_role: role,
        p_from: "2099-09-01T00:00:00+07:00",
        p_to: "2099-10-01T00:00:00+07:00",
        p_date_basis: "appointment",
      });
    },
  );
  it("rejects a summary request after staff membership is removed", async () => {
    const result = await executeConversationTool(
      { ...actor, isOwner: true },
      {
        type: "function_call",
        name: "owner_booking_summary",
        call_id: "summary-call",
        arguments: JSON.stringify({ from: null, to: null, dateBasis: "created" }),
      },
    );
    expect(result).toMatchObject({ ok: false, error: "not_authorized" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("conversation date/time presentation", () => {
  it("saves drafts using server settings instead of an AI-supplied timezone", async () => {
    expect(
      await executeConversationTool(actor, {
        type: "function_call",
        name: "save_booking_details",
        call_id: "draft-call",
        arguments: JSON.stringify({ ...booking, timezone: "America/New_York" }),
      }),
    ).toMatchObject({ ok: true });
    expect(operations).toContainEqual({
      table: "booking_drafts",
      method: "upsert",
      args: [
        expect.objectContaining({ starts_at: booking.startsAt, timezone: "Asia/Bangkok" }),
        { onConflict: "conversation_id" },
      ],
    });
    const tool = toolsForActor(actor).find((tool) => tool.name === "save_booking_details");
    expect(tool?.parameters?.properties).not.toHaveProperty("timezone");
  });

  it.each([
    ["Asia/Bangkok", "2099-09-18T20:30:00Z", "2099-09-19 03:30"],
    ["Europe/Berlin", "2099-01-18T08:00:00Z", "2099-01-18 09:00"],
    ["Europe/Berlin", "2099-07-18T08:00:00Z", "2099-07-18 10:00"],
  ])(
    "formats %s booking instants across midnight and seasonal offsets",
    async (timezone, startsAt, label) => {
      tables.set("platform_settings", { platform_timezone: timezone });
      expect(await create({ startsAt })).toMatchObject({ ok: true, startsAt: label });
      expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
        p_timezone_snapshot: timezone,
        p_local_time_label: label,
      });
    },
  );

  it.each(["list_my_bookings", "owner_list_bookings", "technician_list_bookings"])(
    "%s reformats historical labels using the current platform setting",
    async (name) => {
      tables.set("business_owners", { business_id: "business" });
      tables.set("technicians", [{ id: technicianId }]);
      tables.set("bookings", [
        {
          id: "booking",
          starts_at: "2099-09-18T08:00:00Z",
          local_time_label: "2099-09-18 10:00 CEST",
        },
      ]);
      expect(
        await executeConversationTool(actor, {
          type: "function_call",
          name,
          call_id: "list-call",
          arguments: JSON.stringify({ from: null, to: null, status: null, offset: 0 }),
        }),
      ).toMatchObject({
        ok: true,
        bookings: [{ id: "booking", local_time_label: "2099-09-18 15:00" }],
      });
    },
  );

  it.each(["confirmed", "cancelled"])(
    "%s notifications and AI-outage fallbacks contain only the configured clock time",
    async (status) => {
      tables.set("salons", [salon]);
      tables.set("technicians", {
        display_name: "Mai",
        wa_id: "49152222222",
        salon_id: salonId,
        active: true,
      });
      tables.set("contacts", { display_name: "Sam", wa_id: actor.waId });
      tables.set("bookings", {
        id: salonId,
        technician_ref: technicianId,
        starts_at: "2099-09-18T08:00:00Z",
        local_time_label: "2099-09-18 10:00 CEST",
        salon: { name: salon.name },
      });
      mocks.response.mockRejectedValue(new Error("provider unavailable"));
      const result =
        status === "confirmed"
          ? await create({ technicianRef: technicianId })
          : await executeConversationTool(actor, {
              type: "function_call",
              name: "cancel_booking",
              call_id: "cancel-call",
              arguments: JSON.stringify({ bookingId: salonId, reason: null }),
            });
      expect(result).toMatchObject({ ok: true });
      expect(JSON.parse(mocks.response.mock.calls[0][0].input).appointment).toBe(
        "2099-09-18 15:00",
      );
      expect(mocks.queue.mock.calls[0][0].payload).toEqual({
        kind: "text",
        text: [
          status === "confirmed" ? "✅" : "❌",
          "Mitte",
          "Sam",
          actor.waId,
          "2099-09-18 15:00",
          status === "confirmed" ? "booking-id" : salonId,
        ].join("\n"),
      });
    },
  );
});
