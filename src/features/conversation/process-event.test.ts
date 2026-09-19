import { beforeEach, describe, expect, it, vi } from "vitest";

// Focused on the booking-intent hand-off wiring this module owns: the code is
// extracted/stripped before history is stored, the actual claim only happens
// after the existing duplicate/replay early-return, and a replayed event
// never re-attempts a claim. The surrounding AI-reply pipeline is stubbed out
// (see conversation.test.ts for its own coverage).
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createNaturalReply: vi.fn(),
  claimBookingIntentByCode: vi.fn(),
  queueWhatsAppMessage: vi.fn(),
  queueInteractiveChoices: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("./respond", () => ({ createNaturalReply: mocks.createNaturalReply }));
vi.mock("@/features/booking-intents/claim", () => ({
  claimBookingIntentByCode: mocks.claimBookingIntentByCode,
}));
vi.mock("@/features/messaging/outbox", () => ({
  queueWhatsAppMessage: mocks.queueWhatsAppMessage,
  queueInteractiveChoices: mocks.queueInteractiveChoices,
}));

import { processWhatsAppInboxEvent } from "./process-event";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const CONTACT_ID = "00000000-0000-4000-8000-000000000801";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000901";
const BUSINESS_ID = "00000000-0000-4000-8000-000000000701";
const INBOX_EVENT_ID = "00000000-0000-4000-8000-000000001001";

type StubResponse = { data?: unknown; error?: unknown };

// FIFO-per-table stub, matching processWhatsAppInboxEvent's fixed call order
// for a single message event (see the seedHappyPath() calls below).
function createSupabaseStub() {
  const queues: Record<string, StubResponse[]> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const order: string[] = [];

  function push(table: string, response: StubResponse) {
    (queues[table] ??= []).push(response);
  }

  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "is",
      "not",
      "order",
      "limit",
      "insert",
      "update",
      "upsert",
    ]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }
    const resolve = () => {
      const queue = queues[table];
      const response = queue?.length ? queue.shift()! : { data: null, error: null };
      order.push(`from:${table}`);
      return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
    };
    query.single = resolve;
    query.maybeSingle = resolve;
    query.then = (onFulfilled: (value: unknown) => unknown) => resolve().then(onFulfilled);
    return query;
  });

  return { from, push, calls, order };
}

let stub: ReturnType<typeof createSupabaseStub>;

function baseEvent(text: string) {
  return {
    kind: "message" as const,
    contactWaId: "49151111111",
    profileName: "Jane",
    simulated: false,
    occurredAt: "2026-09-18T10:00:00.000Z",
    providerEventId: "wamid.123",
    message: {
      type: "text",
      text,
      interactiveTitle: null,
      caption: null,
      mediaId: null,
      interactiveId: null,
      mimeType: null,
    },
  };
}

function seedInboxEvent(event: ReturnType<typeof baseEvent>) {
  stub.push("whatsapp_inbox_events", {
    data: { organization_id: ORGANIZATION_ID, processed_at: null, payload: event },
  });
}

function seedHappyPathThroughReply() {
  stub.push("organization_settings", { data: { simulator_enabled: false, bot_locale: "en" } });
  stub.push("contacts", { data: { id: CONTACT_ID } });
  stub.push("conversations", {
    data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
  });
  // conversation_messages upsert (history) resolves after the salon fixtures below.
  stub.push("business_owners", { data: [] });
  stub.push("technicians", { data: [] });
  stub.push("businesses", { data: { id: BUSINESS_ID } });
  stub.push("conversation_messages", { data: null }); // no recent media lookup match
  stub.push("conversations", { data: null, error: null }); // reply_locale update
  stub.push("whatsapp_inbox_events", { data: null, error: null }); // markProcessed
}

beforeEach(() => {
  vi.clearAllMocks();
  stub = createSupabaseStub();
  mocks.from.mockImplementation(stub.from);
  mocks.createNaturalReply.mockResolvedValue(null);
  mocks.claimBookingIntentByCode.mockImplementation(async () => {
    stub.order.push("claim");
    return true;
  });
});

describe("processWhatsAppInboxEvent booking-intent hand-off", () => {
  it("strips the [BK-...] tag before saving history, then claims the plain code afterward", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] I'd like to book a manicure.");
    seedInboxEvent(event);
    stub.push("conversation_messages", { data: { id: "history-row" } }); // fresh, non-duplicate history row
    seedHappyPathThroughReply();

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    const historyUpsert = stub.calls.find(
      (call) => call.table === "conversation_messages" && call.method === "upsert",
    );
    expect((historyUpsert?.args[0] as Record<string, unknown>).text_content).toBe(
      "I'd like to book a manicure.",
    );
    expect(mocks.claimBookingIntentByCode).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      CONVERSATION_ID,
      "ABCDEFGHJKMNP",
    );

    // The claim happens strictly after the history save resolved, not before
    // (history is the first conversation_messages resolution; a second one,
    // for the recent-media lookup, comes later still).
    const historyIndex = stub.order.indexOf("from:conversation_messages");
    const claimIndex = stub.order.indexOf("claim");
    expect(historyIndex).toBeGreaterThanOrEqual(0);
    expect(claimIndex).toBeGreaterThan(historyIndex);
  });

  it("does not attempt a claim when the message carries no [BK-...] tag", async () => {
    const event = baseEvent("just a normal message");
    seedInboxEvent(event);
    stub.push("conversation_messages", { data: { id: "history-row" } });
    seedHappyPathThroughReply();

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.claimBookingIntentByCode).not.toHaveBeenCalled();
  });

  it("never attempts a claim on a replayed event that already has a queued reply", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] I'd like to book a manicure.");
    seedInboxEvent(event);
    stub.push("organization_settings", { data: { simulator_enabled: false, bot_locale: "en" } });
    stub.push("contacts", { data: { id: CONTACT_ID } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    // ignoreDuplicates conflict: no fresh row, this event was already saved once.
    stub.push("conversation_messages", { data: null });
    stub.push("message_outbox", { data: { payload: { kind: "text", text: "already replied" } } });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ duplicate: true });
    expect(mocks.claimBookingIntentByCode).not.toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { kind: "text", text: "already replied" } }),
    );
  });
});
