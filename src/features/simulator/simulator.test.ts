import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  authenticated: true,
  from: vi.fn(),
  rpc: vi.fn(),
  dispatch: vi.fn(),
  graphSend: vi.fn(),
  reply: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({
  isWhatsAppSimulatorEnabled: () => mocks.enabled,
  getBotLocale: () => "en",
  getServerEnv: () => ({ OPENAI_API_KEY: "test-key", BOT_LOCALE: "en" }),
}));
vi.mock("@/lib/auth/api-admin", () => ({
  requireApiAdmin: async () => ({
    admin: mocks.authenticated ? { id: "admin" } : null,
    error: mocks.authenticated ? null : new Response(null, { status: 401 }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: mocks.dispatch } }));
vi.mock("@/integrations/whatsapp/client", () => ({ sendWhatsAppMessage: mocks.graphSend }));
vi.mock("@/features/conversation/respond", () => ({ createNaturalReply: mocks.reply }));

import { GET as getActors } from "@/app/api/admin/simulator/actors/route";
import { GET as getMessages, POST as postMessage } from "@/app/api/admin/simulator/messages/route";
import { processWhatsAppInboxEvent } from "@/features/conversation/process-event";
import { executeConversationTool, type ConversationActor } from "@/features/conversation/tools";
import { deliverWhatsAppOutboxMessage, queueWhatsAppMessage } from "@/features/messaging/outbox";
import { receiveWhatsAppWebhook } from "@/features/messaging/receive-webhook";
import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import { verifyWhatsAppSignature } from "@/integrations/whatsapp/security";
import { simulatorSendSchema } from "./contracts";
import { groupSimulatorIdentities, resolveSimulatorIdentity } from "./identities";
import { listSimulatorMessages } from "./service";
import { createSimulatorWebhook } from "./webhook";

type DbResult = { data: unknown; error: unknown };
const tables = new Map<string, DbResult>();
const operations: { table: string; method: string; args: unknown[] }[] = [];
const input = {
  requestId: "f466ba83-2843-4aaf-8d45-2082d9999416",
  identity: { kind: "customer" as const, waId: "4915112345678", name: "Test Ada" },
  message: { kind: "text" as const, text: "Hallo" },
};
const secret = "synthetic-signing-key";
const naturalReply = {
  locale: "en",
  text: "Hello! How can I help?",
  unavailableText: "Please try again shortly.",
  buttonLabel: "Choose",
  sectionTitle: "Options",
  options: [],
};

function setTable(table: string, data: unknown) {
  tables.set(table, { data, error: null });
}
function writes(table: string, method = "upsert") {
  return operations
    .filter((item) => item.table === table && item.method === method)
    .map((item) => item.args[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.authenticated = true;
  tables.clear();
  operations.length = 0;
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
      "update",
      "upsert",
      "insert",
      "single",
      "maybeSingle",
    ]) {
      query[method] = (...args: unknown[]) => {
        operations.push({ table, method, args });
        return query;
      };
    }
    query.then = (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(tables.get(table) ?? { data: [], error: null }).then(resolve, reject);
    return query;
  });
  mocks.rpc.mockResolvedValue({
    data: [{ accepted: true, inbox_event_id: "inbox", job_outbox_id: "job" }],
    error: null,
  });
  mocks.dispatch.mockResolvedValue({ ids: ["event"] });
  mocks.graphSend.mockResolvedValue("wamid.real.delivery");
  mocks.reply.mockResolvedValue({
    locale: "vi",
    text: "Xin chào! Bạn cần giúp gì?",
    unavailableText: "Vui lòng thử lại sau.",
    buttonLabel: "Chọn",
    sectionTitle: "Lựa chọn",
    options: [],
  });
});

describe("simulator identity and input boundaries", () => {
  it("groups the configured business membership and both roles by stored WhatsApp identity", () => {
    const actors = groupSimulatorIdentities(
      [{ contact: { wa_id: "4912345", display_name: null }, business: { name: "South" } }],
      [{ wa_id: "4912345", display_name: "Test Owner", salon: { name: "Mitte" } }],
    );
    expect(actors).toEqual([
      {
        waId: "4912345",
        name: "Test Owner",
        roles: ["owner", "technician"],
        business: "South",
        salons: ["Mitte"],
      },
    ]);
    expect(resolveSimulatorIdentity({ kind: "staff", waId: "4912345" }, actors).name).toBe(
      "Test Owner",
    );
    expect(() =>
      resolveSimulatorIdentity(
        { kind: "customer", waId: "4912345", name: "Pretend customer" },
        actors,
      ),
    ).toThrow("database chat window");
    expect(() => resolveSimulatorIdentity({ kind: "staff", waId: "4912346" }, actors)).toThrow(
      "no longer exists",
    );
  });

  it("rejects invalid identities, blank messages, media input and client-claimed staff roles", () => {
    expect(simulatorSendSchema.safeParse(input).success).toBe(true);
    for (const identity of [
      { ...input.identity, waId: "+4912345" },
      { ...input.identity, name: " " },
      { kind: "staff", waId: "4912345", roles: ["owner"] },
    ])
      expect(simulatorSendSchema.safeParse({ ...input, identity }).success).toBe(false);
    expect(
      simulatorSendSchema.safeParse({ ...input, message: { kind: "text", text: " " } }).success,
    ).toBe(false);
    expect(
      simulatorSendSchema.safeParse({ ...input, message: { kind: "image", mediaId: "test-media" } })
        .success,
    ).toBe(false);
  });
});

describe("signed webhook and durable registration", () => {
  it.each(["button_reply", "list_reply"] as const)(
    "uses the real normalizer for %s",
    (replyType) => {
      const webhook = createSimulatorWebhook(
        {
          ...input,
          message: { kind: "interactive", replyType, id: "salon:test", title: "Test salon" },
        },
        input.identity,
        secret,
      );
      expect(verifyWhatsAppSignature(webhook.rawBody, webhook.signature, secret)).toBe(true);
      expect(normalizeWhatsAppWebhook(JSON.parse(webhook.rawBody))[0]).toMatchObject({
        contactWaId: input.identity.waId,
        profileName: input.identity.name,
        message: {
          type: "interactive",
          interactiveId: "salon:test",
          interactiveTitle: "Test salon",
        },
      });
      expect(webhook.providerEventId).toBe(
        createSimulatorWebhook(input, input.identity, secret).providerEventId,
      );
    },
  );

  it("rejects invalid signatures before database access", async () => {
    expect((await receiveWhatsAppWebhook("{}", "invalid", secret)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("persists the trusted simulator marker and leaves failed dispatch for recovery", async () => {
    mocks.dispatch.mockRejectedValueOnce(new Error("Inngest unavailable"));
    const webhook = createSimulatorWebhook(input, input.identity, secret);
    expect(
      (await receiveWhatsAppWebhook(webhook.rawBody, webhook.signature, secret, true)).status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_whatsapp_event",
      expect.objectContaining({ p_payload: expect.objectContaining({ simulated: true }) }),
    );
    expect(writes("job_outbox", "update")).toEqual([]);
    mocks.rpc.mockResolvedValueOnce({ data: [{ accepted: false }], error: null });
    await receiveWhatsAppWebhook(webhook.rawBody, webhook.signature, secret, true);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not accept a simulator marker from the public webhook body", async () => {
    const webhook = createSimulatorWebhook(input, input.identity, secret);
    const payload = JSON.parse(webhook.rawBody);
    payload.simulated = true;
    payload.entry[0].changes[0].value.messages[0].simulated = true;
    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    await receiveWhatsAppWebhook(rawBody, signature, secret);
    expect(mocks.rpc.mock.calls[0][1].p_payload).not.toHaveProperty("simulated");
  });
});

describe("authenticated simulator APIs", () => {
  const request = () =>
    new Request("http://localhost/api/admin/simulator/messages", {
      method: "POST",
      body: JSON.stringify(input),
    });
  it.each([false, true])("requires an admin when enabled=%s", async (enabled) => {
    mocks.enabled = enabled;
    mocks.authenticated = false;
    expect((await getActors()).status).toBe(401);
    expect((await getMessages(new Request("http://localhost/?waId=4912345"))).status).toBe(401);
    expect((await postMessage(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns 404 for every endpoint when disabled", async () => {
    mocks.enabled = false;
    expect((await getActors()).status).toBe(404);
    expect((await getMessages(new Request("http://localhost/?waId=4912345"))).status).toBe(404);
    expect((await postMessage(request())).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("accepts synthetic messages without Meta credentials and rechecks staff mappings", async () => {
    expect((await postMessage(request())).status).toBe(202);
    const stale = new Request("http://localhost/api/admin/simulator/messages", {
      method: "POST",
      body: JSON.stringify({ ...input, identity: { kind: "staff", waId: input.identity.waId } }),
    });
    expect((await postMessage(stale)).status).toBe(409);
    expect(operations).toContainEqual({
      table: "technicians",
      method: "eq",
      args: ["active", true],
    });
    expect(operations).toContainEqual({
      table: "technicians",
      method: "is",
      args: ["deleted_at", null],
    });
  });
  it("returns validation errors for malformed JSON", async () => {
    expect(
      (await postMessage(new Request("http://localhost/", { method: "POST", body: "{" }))).status,
    ).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("coexisting real and simulated conversations", () => {
  function conversationFixture(simulated: boolean) {
    const event = normalizeWhatsAppWebhook(
      JSON.parse(createSimulatorWebhook(input, input.identity, secret).rawBody),
    )[0];
    setTable("whatsapp_inbox_events", {
      payload: { ...event, ...(simulated ? { simulated: true } : {}) },
      processed_at: null,
    });
    setTable("contacts", { id: "contact" });
    setTable("conversations", {
      id: "conversation",
      reply_locale: null,
      reply_unavailable_text: null,
    });
    setTable("conversation_messages", { id: "history" });
    setTable("booking_drafts", null);
    setTable("platform_settings", {});
    setTable("message_outbox", { id: "outbox", state: "pending" });
  }
  it.each([false, true])(
    "keeps histories and replies on their source channel (simulated=%s)",
    async (simulated) => {
      conversationFixture(simulated);
      await processWhatsAppInboxEvent("inbox");
      expect(writes("conversations")[0]).toMatchObject({
        channel: simulated ? "whatsapp_simulator" : "whatsapp",
      });
      expect(mocks.reply).toHaveBeenCalledTimes(1);
      expect(writes("message_outbox")).toHaveLength(1);
      expect(writes("conversations", "update")).toContainEqual({
        reply_locale: "vi",
        reply_unavailable_text: "Vui lòng thử lại sau.",
      });
      for (const outbox of writes("message_outbox"))
        expect(outbox).toMatchObject({
          payload: { transport: simulated ? "simulator" : "whatsapp" },
        });
    },
  );
  it("pauses simulated inbound work when the flag is disabled", async () => {
    conversationFixture(true);
    mocks.enabled = false;
    await expect(processWhatsAppInboxEvent("inbox")).rejects.toThrow("simulator_disabled");
    expect(writes("contacts")).toEqual([]);
  });
  it.each([false, true])(
    "retries a failed reply after inbound history was already saved (simulated=%s)",
    async (simulated) => {
      conversationFixture(simulated);
      mocks.reply.mockRejectedValueOnce(new Error("context_query_failed"));
      await expect(processWhatsAppInboxEvent("inbox")).rejects.toThrow("context_query_failed");
      expect(writes("whatsapp_inbox_events", "update")).toEqual([]);
      expect(writes("message_outbox")).toEqual([]);

      setTable("conversation_messages", null);
      setTable("message_outbox", null);
      mocks.reply.mockImplementationOnce(async () => {
        setTable("message_outbox", { id: "outbox", state: "pending" });
        return naturalReply;
      });
      expect(await processWhatsAppInboxEvent("inbox")).toEqual({ processed: "message" });
      expect(mocks.reply).toHaveBeenCalledTimes(2);
      expect(writes("message_outbox")).toHaveLength(1);
      expect(writes("message_outbox")[0]).toMatchObject({
        payload: { text: naturalReply.text, transport: simulated ? "simulator" : "whatsapp" },
      });
      expect(writes("whatsapp_inbox_events", "update")).toEqual([
        { processed_at: expect.any(String), failure_code: null },
      ]);
    },
  );
  it("redispatches an already queued reply on retry without another AI call", async () => {
    conversationFixture(true);
    mocks.dispatch.mockRejectedValueOnce(new Error("dispatch_unavailable"));
    await expect(processWhatsAppInboxEvent("inbox")).rejects.toThrow("dispatch_unavailable");
    expect(writes("whatsapp_inbox_events", "update")).toEqual([]);
    const queued = writes("message_outbox")[0] as { payload: unknown };

    setTable("conversation_messages", null);
    setTable("message_outbox", { id: "outbox", state: "pending", payload: queued.payload });
    expect(await processWhatsAppInboxEvent("inbox")).toEqual({ duplicate: true });
    expect(mocks.reply).toHaveBeenCalledTimes(1);
    expect(writes("message_outbox")).toEqual([queued, queued]);
    expect(mocks.dispatch).toHaveBeenLastCalledWith({
      name: "whatsapp/message.queued",
      data: { outboxId: "outbox" },
    });
    expect(writes("whatsapp_inbox_events", "update")).toHaveLength(1);
  });
  it("skips a fully processed event without regenerating or requeueing its reply", async () => {
    conversationFixture(true);
    setTable("whatsapp_inbox_events", { processed_at: "2026-09-16T00:00:00Z" });
    expect(await processWhatsAppInboxEvent("inbox")).toEqual({ duplicate: true });
    expect(mocks.reply).not.toHaveBeenCalled();
    expect(writes("message_outbox")).toEqual([]);
  });
  it("does not report completion when the final inbox update fails", async () => {
    conversationFixture(true);
    const error = { code: "08006", message: "database_unavailable" };
    mocks.reply.mockImplementationOnce(async () => {
      tables.set("whatsapp_inbox_events", { data: null, error });
      return naturalReply;
    });
    await expect(processWhatsAppInboxEvent("inbox")).rejects.toEqual(error);
    expect(writes("message_outbox")).toHaveLength(1);
  });
  it.each([2, 5])(
    "delivers AI-written foreign-language controls as one reply (%i options)",
    async (count) => {
      conversationFixture(true);
      const options = Array.from({ length: count }, (_, i) => ({
        id: `reply:${i}`,
        title: `ตัวเลือก ${i + 1}`,
        description: null,
      }));
      mocks.reply.mockResolvedValue({
        locale: "th",
        text: "คุณต้องการวันไหน?",
        unavailableText: "กรุณาลองอีกครั้ง",
        buttonLabel: "เลือก",
        sectionTitle: "ตัวเลือก",
        options,
      });
      await processWhatsAppInboxEvent("inbox");
      expect(writes("message_outbox")).toHaveLength(1);
      expect(writes("message_outbox")[0]).toMatchObject({
        payload: {
          kind: count <= 3 ? "buttons" : "list",
          body: "คุณต้องการวันไหน?",
          options: options.map(({ id, title }) => ({ id, title })),
        },
      });
      if (count > 3)
        expect(writes("message_outbox")[0]).toMatchObject({
          payload: { buttonLabel: "เลือก", sectionTitle: "ตัวเลือก" },
        });
    },
  );
  it("uses the saved localized fallback when AI is unavailable", async () => {
    conversationFixture(true);
    setTable("conversations", {
      id: "conversation",
      reply_locale: "vi",
      reply_unavailable_text: "Vui lòng thử lại sau.",
    });
    mocks.reply.mockResolvedValue(null);
    await processWhatsAppInboxEvent("inbox");
    expect(writes("message_outbox")[0]).toMatchObject({
      payload: { kind: "text", text: "Vui lòng thử lại sau." },
    });
  });
  it("routes technician notifications according to the originating tool call", async () => {
    setTable("tool_executions", { id: "tool", state: "started", result: null });
    setTable("bookings", {
      technician_ref: "bfa0a100-6a99-47ad-9735-9d38b1299adc",
      starts_at: "2026-09-16T12:00:00Z",
      local_time_label: "2026-09-16 14:00 CEST",
      salon: [{ name: "Mitte" }],
    });
    setTable("technicians", { wa_id: "4915999999999" });
    setTable("contacts", { display_name: "Test Ada", wa_id: input.identity.waId });
    setTable("platform_settings", {
      technician_booking_cancelled_template: "technician_booking_cancelled",
      platform_timezone: "Asia/Bangkok",
    });
    setTable("message_outbox", { id: "notification", state: "pending" });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const actor: ConversationActor = {
      conversationId: "conversation",
      contactId: "contact",
      waId: input.identity.waId,
      isOwner: false,
      technicianIds: [],
      currentMediaId: null,
      transport: "simulator",
    };
    await executeConversationTool(actor, {
      type: "function_call",
      name: "cancel_booking",
      call_id: "test-call",
      arguments: JSON.stringify({
        bookingId: "bab0a100-6a99-47ad-9735-9d38b1299adc",
        reason: null,
      }),
    });
    expect(writes("message_outbox")[0]).toMatchObject({
      recipient_wa_id: "4915999999999",
      conversation_id: null,
      payload: {
        transport: "simulator",
        kind: "template",
        name: "technician_booking_cancelled",
        bodyParameters: [
          "Mitte",
          "Test Ada",
          input.identity.waId,
          "2026-09-16 19:00",
          "bab0a100-6a99-47ad-9735-9d38b1299adc",
        ],
      },
    });
  });
  it.each([true, false])(
    "never sends a durable simulated message to Meta (flag=%s)",
    async (enabled) => {
      mocks.enabled = enabled;
      setTable("message_outbox", {
        id: "outbox",
        recipient_wa_id: input.identity.waId,
        conversation_id: "conversation",
        state: "pending",
        attempt_count: 0,
        payload: { kind: "text", text: "Test reply", transport: "simulator" },
      });
      expect(await deliverWhatsAppOutboxMessage("outbox")).toBe("wamid.simulator.outbox.outbox");
      expect(mocks.graphSend).not.toHaveBeenCalled();
      expect(writes("conversation_messages")[0]).toMatchObject({
        direction: "outbound",
        text_content: "Test reply",
      });
    },
  );
  it("continues real delivery with the simulator enabled", async () => {
    setTable("message_outbox", {
      id: "outbox",
      recipient_wa_id: input.identity.waId,
      state: "pending",
      attempt_count: 0,
      payload: { kind: "text", text: "Real-path test", transport: "whatsapp" },
    });
    expect(await deliverWhatsAppOutboxMessage("outbox")).toBe("wamid.real.delivery");
    expect(mocks.graphSend).toHaveBeenCalledWith(
      input.identity.waId,
      expect.objectContaining({ text: "Real-path test" }),
    );
  });
  it("fails simulated delivery on the same outgoing button limits as Meta delivery", async () => {
    setTable("message_outbox", {
      id: "outbox",
      recipient_wa_id: input.identity.waId,
      state: "pending",
      attempt_count: 0,
      payload: { kind: "buttons", body: "Invalid choices", options: [], transport: "simulator" },
    });
    await expect(deliverWhatsAppOutboxMessage("outbox")).rejects.toThrow(
      "whatsapp_buttons_require_1_to_3_options",
    );
    expect(mocks.graphSend).not.toHaveBeenCalled();
    expect(writes("message_outbox", "update")).toContainEqual({
      state: "failed",
      failure_code: "whatsapp_buttons_require_1_to_3_options",
    });
  });
  it("defaults unmarked new messages to real delivery", async () => {
    setTable("message_outbox", { id: "outbox", state: "pending" });
    await queueWhatsAppMessage({
      recipientWaId: input.identity.waId,
      payload: { kind: "text", text: "Real path" },
      deduplicationKey: "test-key",
    });
    expect(writes("message_outbox")[0]).toMatchObject({ payload: { transport: "whatsapp" } });
  });
  it("reads only simulated traffic, including notifications without a conversation", async () => {
    setTable("message_outbox", [
      {
        id: "notice",
        payload: {
          kind: "template",
          name: "booking_confirmed",
          bodyParameters: ["Test salon", "Tomorrow", "test-booking"],
        },
        state: "sent",
        provider_message_id: "wamid.simulator.outbox.notice",
        created_at: "2026-09-15T10:00:00Z",
      },
    ]);
    const result = await listSimulatorMessages(input.identity.waId);
    expect(result.messages[0]).toMatchObject({
      state: "captured",
      text: "booking_confirmed\nTest salon\nTomorrow\ntest-booking",
    });
    expect(operations).toContainEqual({
      table: "message_outbox",
      method: "eq",
      args: ["payload->>transport", "simulator"],
    });
    expect(operations).toContainEqual({
      table: "whatsapp_inbox_events",
      method: "eq",
      args: ["payload->>simulated", "true"],
    });
  });
});
