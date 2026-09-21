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
  confirmBookingFromIntent: vi.fn(),
  cancelBookingForContact: vi.fn(),
  checkinBookingByStaff: vi.fn(),
  rescheduleBookingFromDraft: vi.fn(),
  inngestSend: vi.fn(),
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
vi.mock("@/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));
// formatCancelAction/parseCancelAction stay real -- they're the pure encoding
// this suite relies on to recognize a Cancel tap; only the DB-touching
// booking actions are stubbed (scripted-flow.test.ts covers those directly).
vi.mock("./scripted-flow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scripted-flow")>();
  return {
    ...actual,
    confirmBookingFromIntent: mocks.confirmBookingFromIntent,
    cancelBookingForContact: mocks.cancelBookingForContact,
    checkinBookingByStaff: mocks.checkinBookingByStaff,
    rescheduleBookingFromDraft: mocks.rescheduleBookingFromDraft,
  };
});

import { processWhatsAppInboxEvent } from "./process-event";
import { formatCancelAction, formatUpdateAction, SKIP_ACTION } from "./scripted-flow";
import { formatCheckinTag } from "@/features/bookings/checkin-code";
import { formatStaticMessage, resolveStaticMessages } from "@/lib/bot/static-messages";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const CONTACT_ID = "00000000-0000-4000-8000-000000000801";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000901";
const BUSINESS_ID = "00000000-0000-4000-8000-000000000701";
const INBOX_EVENT_ID = "00000000-0000-4000-8000-000000001001";
const BOOKING_ID = "6fcb66a0-d713-4bfc-a075-0e7d3864bafd";

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

function seedInboxEvent(event: ReturnType<typeof baseEvent> | ReturnType<typeof cancelTapEvent>) {
  stub.push("whatsapp_inbox_events", {
    data: { organization_id: ORGANIZATION_ID, processed_at: null, payload: event },
  });
}

function seedHappyPathThroughReply() {
  stub.push("organization_settings", {
    data: {
      simulator_enabled: false,
      bot_locale: "en",
      ai_bot_enabled: true,
      external_website_url: null,
    },
  });
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
    // A claim now books deterministically even with the bot enabled; this
    // test only cares about strip/claim ordering, so any resolvable outcome
    // works.
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      startsAt: "2099-09-18 15:00",
    });

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
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
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

function seedScriptedSettings(externalWebsiteUrl: string | null = "https://example.com") {
  stub.push("organization_settings", {
    data: {
      simulator_enabled: false,
      bot_locale: "en",
      ai_bot_enabled: false,
      external_website_url: externalWebsiteUrl,
    },
  });
  stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
  stub.push("conversations", {
    data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
  });
}

describe("processWhatsAppInboxEvent scripted mode (AI bot disabled)", () => {
  it("offers Update/Skip rather than the greeting when a customer with an active booking sends a new message", async () => {
    const event = baseEvent("I'd like to book another appointment.");
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("bookings", {
      data: { id: BOOKING_ID, local_time_label: "18 Sep, 15:00" },
    });
    stub.push("whatsapp_inbox_events", { data: null, error: null });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.createNaturalReply).not.toHaveBeenCalled();
    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatUpdateAction(BOOKING_ID), title: resolveStaticMessages("en").updateAction },
          { id: SKIP_ACTION, title: resolveStaticMessages("en").skipAction },
        ],
      }),
    );
    expect(mocks.queueWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("claims a [BK-...] code, books the appointment, and queues an interactive Cancel option", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } }); // fresh, non-duplicate history row
    stub.push("businesses", { data: { id: BUSINESS_ID } });
    stub.push("whatsapp_inbox_events", { data: null, error: null }); // markProcessed
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      startsAt: "2099-09-18 15:00",
      technician: "Mai",
    });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.confirmBookingFromIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        businessId: BUSINESS_ID,
        contactId: CONTACT_ID,
        conversationId: CONVERSATION_ID,
        transport: "whatsapp",
      }),
    );
    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: resolveStaticMessages("en").cancelAction },
        ],
      }),
    );
    const body = mocks.queueInteractiveChoices.mock.calls[0][0].body as string;
    expect(body).toContain(BOOKING_ID);
    expect(mocks.createNaturalReply).not.toHaveBeenCalled();
    expect(stub.calls.some((call) => call.table === "business_owners")).toBe(false);
    expect(stub.calls.some((call) => call.table === "technicians")).toBe(false);
  });

  it("sends the static greeting containing the external website when there is no booking code", async () => {
    const event = baseEvent("hello there");
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.claimBookingIntentByCode).not.toHaveBeenCalled();
    expect(mocks.confirmBookingFromIntent).not.toHaveBeenCalled();
    expect(mocks.createNaturalReply).not.toHaveBeenCalled();
    expect(stub.calls.some((call) => call.table === "business_owners")).toBe(false);
    expect(stub.calls.some((call) => call.table === "technicians")).toBe(false);
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: expect.stringContaining("https://example.com") },
      }),
    );
  });

  it("falls through to the greeting when the code is unknown, already consumed, or expired", async () => {
    const event = baseEvent("[BK-ZZZZZZZZZZZZZ] hi");
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.claimBookingIntentByCode.mockResolvedValueOnce(null);

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.confirmBookingFromIntent).not.toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: expect.stringContaining("https://example.com") },
      }),
    );
  });

  it("falls back to the deployment root URL when external_website_url is null", async () => {
    const event = baseEvent("hello there");
    seedInboxEvent(event);
    seedScriptedSettings(null);
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: expect.stringContaining("http://localhost:3000") },
      }),
    );
  });
});

describe("processWhatsAppInboxEvent hybrid mode (AI bot enabled)", () => {
  it("books a claimed intent deterministically without involving the AI", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } }); // fresh, non-duplicate history row
    stub.push("businesses", { data: { id: BUSINESS_ID } });
    stub.push("whatsapp_inbox_events", { data: null, error: null }); // markProcessed
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      startsAt: "2099-09-18 15:00",
      technician: "Mai",
    });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: resolveStaticMessages("en").cancelAction },
        ],
      }),
    );
    const body = mocks.queueInteractiveChoices.mock.calls[0][0].body as string;
    expect(body).toContain(BOOKING_ID);
    expect(mocks.createNaturalReply).not.toHaveBeenCalled();
    expect(stub.calls.some((call) => call.table === "business_owners")).toBe(false);
    expect(stub.calls.some((call) => call.table === "technicians")).toBe(false);
  });

  it("hands off to the AI when a claimed intent cannot be booked (stale slot or inactive business)", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } }); // history
    stub.push("businesses", { data: { id: BUSINESS_ID } }); // claim-branch lookup
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({ outcome: "unavailable" });
    stub.push("business_owners", { data: [] });
    stub.push("technicians", { data: [] });
    stub.push("businesses", { data: { id: BUSINESS_ID } }); // actor lookup
    stub.push("conversation_messages", { data: null }); // recent media lookup
    stub.push("conversations", { data: null, error: null }); // reply_locale update
    stub.push("whatsapp_inbox_events", { data: null, error: null }); // markProcessed

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.confirmBookingFromIntent).toHaveBeenCalled();
    expect(mocks.createNaturalReply).toHaveBeenCalled();
    expect(stub.calls.some((call) => call.table === "business_owners")).toBe(true);
  });

  it("falls through to the AI on an unknown, expired, or already-consumed code", async () => {
    const event = baseEvent("[BK-ZZZZZZZZZZZZZ] hi");
    seedInboxEvent(event);
    stub.push("conversation_messages", { data: { id: "history-row" } });
    seedHappyPathThroughReply();
    mocks.claimBookingIntentByCode.mockResolvedValueOnce(null);

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.confirmBookingFromIntent).not.toHaveBeenCalled();
    expect(mocks.createNaturalReply).toHaveBeenCalled();
  });

  it("uses the conversation's detected language for a deterministic confirmation when the bot is on", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: "vi", reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("businesses", { data: { id: BUSINESS_ID } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      startsAt: "2099-09-18 15:00",
    });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: resolveStaticMessages("vi").cancelAction },
        ],
      }),
    );
  });

  it("ignores a stale reply_locale and uses bot_locale for a deterministic confirmation when the bot is off", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: false,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: "vi", reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("businesses", { data: { id: BUSINESS_ID } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "confirmed",
      bookingId: BOOKING_ID,
      startsAt: "2099-09-18 15:00",
    });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: resolveStaticMessages("en").cancelAction },
        ],
      }),
    );
  });
});

describe("processWhatsAppInboxEvent AI booking confirmation", () => {
  it("does not duplicate the Cancel option when the model already offered one for the same booking", async () => {
    const event = baseEvent("book me a manicure tomorrow at 3pm");
    seedInboxEvent(event);
    stub.push("conversation_messages", { data: { id: "history-row" } });
    seedHappyPathThroughReply();
    mocks.createNaturalReply.mockResolvedValueOnce({
      locale: "en",
      text: "Booked! ✅",
      unavailableText: "Please try again shortly.",
      buttonLabel: "Options",
      sectionTitle: "Options",
      options: [{ id: formatCancelAction(BOOKING_ID), title: "Cancel booking", description: null }],
      confirmedBookingId: BOOKING_ID,
    });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: "Cancel booking", description: undefined },
        ],
      }),
    );
  });

  it("appends the static Cancel option when the model did not offer one itself", async () => {
    const event = baseEvent("book me a manicure tomorrow at 3pm");
    seedInboxEvent(event);
    stub.push("conversation_messages", { data: { id: "history-row" } });
    seedHappyPathThroughReply();
    mocks.createNaturalReply.mockResolvedValueOnce({
      locale: "en",
      text: "Booked! ✅",
      unavailableText: "Please try again shortly.",
      buttonLabel: "Options",
      sectionTitle: "Options",
      options: [],
      confirmedBookingId: BOOKING_ID,
    });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatCancelAction(BOOKING_ID), title: resolveStaticMessages("en").cancelAction },
        ],
      }),
    );
  });
});

function cancelTapEvent(interactiveId: string) {
  return {
    kind: "message" as const,
    contactWaId: "49151111111",
    profileName: "Jane",
    simulated: false,
    occurredAt: "2026-09-18T10:00:00.000Z",
    providerEventId: "wamid.cancel",
    message: {
      type: "interactive" as const,
      text: null,
      interactiveTitle: "Cancel",
      caption: null,
      mediaId: null,
      interactiveId,
      mimeType: null,
    },
  };
}

describe("processWhatsAppInboxEvent Cancel tap", () => {
  it.each([true, false])(
    "cancels immediately without reaching the model, in both modes (ai_bot_enabled=%s)",
    async (aiBotEnabled) => {
      const event = cancelTapEvent(formatCancelAction(BOOKING_ID));
      seedInboxEvent(event);
      stub.push("organization_settings", {
        data: {
          simulator_enabled: false,
          bot_locale: "en",
          ai_bot_enabled: aiBotEnabled,
          external_website_url: "https://example.com",
        },
      });
      stub.push("contacts", {
        data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" },
      });
      stub.push("conversations", {
        data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
      });
      stub.push("conversation_messages", { data: { id: "history-row" } });
      stub.push("whatsapp_inbox_events", { data: null, error: null });
      mocks.cancelBookingForContact.mockResolvedValueOnce({
        outcome: "cancelled",
        bookingId: BOOKING_ID,
      });

      const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

      expect(result).toEqual({ processed: "message" });
      expect(mocks.cancelBookingForContact).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORGANIZATION_ID,
          contactId: CONTACT_ID,
          bookingId: BOOKING_ID,
        }),
      );
      expect(mocks.createNaturalReply).not.toHaveBeenCalled();
      expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            kind: "text",
            text: expect.stringContaining("https://example.com"),
          },
        }),
      );
    },
  );

  it("replies that the booking can no longer be cancelled when the RPC reports it is not cancellable", async () => {
    const event = cancelTapEvent(formatCancelAction(BOOKING_ID));
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: "https://example.com",
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.cancelBookingForContact.mockResolvedValueOnce({ outcome: "not_cancellable" });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: resolveStaticMessages("en").bookingNotCancellable },
      }),
    );
  });
});

function interactiveTapEvent(interactiveId: string, providerEventId = "wamid.tap") {
  return {
    kind: "message" as const,
    contactWaId: "49151111111",
    profileName: "Jane",
    simulated: false,
    occurredAt: "2026-09-18T10:00:00.000Z",
    providerEventId,
    message: {
      type: "interactive" as const,
      text: null,
      interactiveTitle: "Update booking",
      caption: null,
      mediaId: null,
      interactiveId,
      mimeType: null,
    },
  };
}

describe("processWhatsAppInboxEvent check-in tag", () => {
  function seedCheckinSettings() {
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
  }

  it("flips the booking to checked_in for a verified owner, and strips the tag from stored history", async () => {
    const event = baseEvent(`${formatCheckinTag(BOOKING_ID)} arrived`);
    seedInboxEvent(event);
    seedCheckinSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } }); // fresh history row
    stub.push("business_owners", { data: [{ business_id: BUSINESS_ID }] });
    stub.push("technicians", { data: [] });
    stub.push("whatsapp_inbox_events", { data: null, error: null }); // markProcessed
    mocks.checkinBookingByStaff.mockResolvedValueOnce({
      outcome: "checked_in",
      bookingId: BOOKING_ID,
      customerName: "Jane",
      startsAt: "18 Sep, 15:00",
    });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.checkinBookingByStaff).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      actorContactId: CONTACT_ID,
      actorWaId: "49151111111",
      bookingId: BOOKING_ID,
    });
    const messages = resolveStaticMessages("en");
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          kind: "text",
          text: formatStaticMessage(messages.checkinDone, {
            customer: "Jane",
            appointment: "18 Sep, 15:00",
          }),
        },
      }),
    );
    const historyUpsert = stub.calls.find(
      (call) => call.table === "conversation_messages" && call.method === "upsert",
    );
    expect((historyUpsert?.args[0] as Record<string, unknown>).text_content).toBe("arrived");
  });

  it("flips the booking to checked_in for a verified technician", async () => {
    const event = baseEvent(`${formatCheckinTag(BOOKING_ID)} arrived`);
    seedInboxEvent(event);
    seedCheckinSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("business_owners", { data: [] });
    stub.push("technicians", { data: [{ id: "tech-1" }] });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.checkinBookingByStaff.mockResolvedValueOnce({
      outcome: "already_checked_in",
      bookingId: BOOKING_ID,
    });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.checkinBookingByStaff).toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: resolveStaticMessages("en").checkinAlready },
      }),
    );
  });

  it("silently ignores a non-staff sender's check-in tag and falls through to normal handling", async () => {
    const event = baseEvent(`${formatCheckinTag(BOOKING_ID)} hi`);
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("business_owners", { data: [] });
    stub.push("technicians", { data: [] });
    stub.push("whatsapp_inbox_events", { data: null, error: null });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.checkinBookingByStaff).not.toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: expect.stringContaining("https://example.com") },
      }),
    );
    const historyUpsert = stub.calls.find(
      (call) => call.table === "conversation_messages" && call.method === "upsert",
    );
    expect((historyUpsert?.args[0] as Record<string, unknown>).text_content).not.toContain(
      "[CHECKIN-",
    );
  });

  it("falls through to normal handling when the RPC reports the booking cannot be checked in", async () => {
    const event = baseEvent(`${formatCheckinTag(BOOKING_ID)} hi`);
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("business_owners", { data: [{ business_id: BUSINESS_ID }] });
    stub.push("technicians", { data: [] });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.checkinBookingByStaff.mockResolvedValueOnce({ outcome: "not_checkinable" });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.checkinBookingByStaff).toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: expect.stringContaining("https://example.com") },
      }),
    );
  });
});

describe("processWhatsAppInboxEvent update/skip tap", () => {
  it.each([true, false])(
    "reschedules the existing booking in place on an Update tap, in both modes (ai_bot_enabled=%s)",
    async (aiBotEnabled) => {
      const event = interactiveTapEvent(formatUpdateAction(BOOKING_ID));
      seedInboxEvent(event);
      stub.push("organization_settings", {
        data: {
          simulator_enabled: false,
          bot_locale: "en",
          ai_bot_enabled: aiBotEnabled,
          external_website_url: null,
        },
      });
      stub.push("contacts", {
        data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" },
      });
      stub.push("conversations", {
        data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
      });
      stub.push("conversation_messages", { data: { id: "history-row" } });
      stub.push("whatsapp_inbox_events", { data: null, error: null });
      mocks.rescheduleBookingFromDraft.mockResolvedValueOnce({
        outcome: "updated",
        bookingId: BOOKING_ID,
        startsAt: "18 Sep, 16:00",
      });

      const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

      expect(result).toEqual({ processed: "message" });
      expect(mocks.rescheduleBookingFromDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORGANIZATION_ID,
          contactId: CONTACT_ID,
          conversationId: CONVERSATION_ID,
          bookingId: BOOKING_ID,
          idempotencyKey: "update:wamid.tap",
        }),
      );
      expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            kind: "text",
            text: formatStaticMessage(resolveStaticMessages("en").updateApplied, {
              appointment: "18 Sep, 16:00",
            }),
          },
        }),
      );
    },
  );

  it("replies that the booking can no longer be updated when the reschedule is not possible", async () => {
    const event = interactiveTapEvent(formatUpdateAction(BOOKING_ID));
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.rescheduleBookingFromDraft.mockResolvedValueOnce({ outcome: "not_updatable" });

    await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: resolveStaticMessages("en").updateUnavailable },
      }),
    );
  });

  it("acknowledges a Skip tap and leaves the existing booking untouched", async () => {
    const event = interactiveTapEvent(SKIP_ACTION);
    seedInboxEvent(event);
    stub.push("organization_settings", {
      data: {
        simulator_enabled: false,
        bot_locale: "en",
        ai_bot_enabled: true,
        external_website_url: null,
      },
    });
    stub.push("contacts", { data: { id: CONTACT_ID, display_name: "Jane", wa_id: "49151111111" } });
    stub.push("conversations", {
      data: { id: CONVERSATION_ID, reply_locale: null, reply_unavailable_text: null },
    });
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.rescheduleBookingFromDraft).not.toHaveBeenCalled();
    expect(mocks.queueWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { kind: "text", text: resolveStaticMessages("en").skipAcknowledged },
      }),
    );
  });
});

describe("processWhatsAppInboxEvent active booking limit (booking-intent hits BOOK-10)", () => {
  it("offers the Update/Skip choice, naming the existing booking's time, when a claimed intent hits the active-booking limit", async () => {
    const event = baseEvent("[BK-ABCDEFGHJKMNP] hi");
    seedInboxEvent(event);
    seedScriptedSettings();
    stub.push("conversation_messages", { data: { id: "history-row" } });
    stub.push("businesses", { data: { id: BUSINESS_ID } });
    stub.push("whatsapp_inbox_events", { data: null, error: null });
    mocks.confirmBookingFromIntent.mockResolvedValueOnce({
      outcome: "active_booking",
      bookingId: BOOKING_ID,
      startsAt: "18 Sep, 15:00",
    });

    const result = await processWhatsAppInboxEvent(INBOX_EVENT_ID);

    expect(result).toEqual({ processed: "message" });
    expect(mocks.queueInteractiveChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { id: formatUpdateAction(BOOKING_ID), title: resolveStaticMessages("en").updateAction },
          { id: SKIP_ACTION, title: resolveStaticMessages("en").skipAction },
        ],
      }),
    );
    const body = mocks.queueInteractiveChoices.mock.calls[0][0].body as string;
    expect(body).toContain("18 Sep, 15:00");
    expect(mocks.rescheduleBookingFromDraft).not.toHaveBeenCalled();
  });
});
