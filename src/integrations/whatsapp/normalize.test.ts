import { describe, expect, it } from "vitest";

import { normalizeWhatsAppWebhook } from "./normalize";

describe("normalizeWhatsAppWebhook", () => {
  it("normalizes text, image identifiers, interactive replies, and statuses", () => {
    const value = {
      contacts: [{ wa_id: "491234", profile: { name: "Ada" } }],
      messages: [
        {
          id: "m1",
          from: "491234",
          timestamp: "1789466400",
          type: "text",
          text: { body: "Hallo" },
        },
        {
          id: "m2",
          from: "491234",
          timestamp: "1789466401",
          type: "image",
          image: { id: "media-1", mime_type: "image/jpeg", caption: "French style" },
        },
        {
          id: "m3",
          from: "491234",
          timestamp: "1789466402",
          type: "interactive",
          interactive: { list_reply: { id: "salon:abc", title: "Mitte" } },
        },
      ],
      statuses: [
        {
          id: "outbound-1",
          recipient_id: "491234",
          timestamp: "1789466403",
          status: "failed",
          errors: [{ code: 131047 }],
        },
      ],
    };
    const events = normalizeWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value }] }],
    });

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      providerEventId: "m1",
      kind: "message",
      contactWaId: "491234",
      profileName: "Ada",
      message: { type: "text", text: "Hallo" },
    });
    expect(events[1]).toMatchObject({ message: { mediaId: "media-1", mimeType: "image/jpeg" } });
    expect(events[2]).toMatchObject({ message: { interactiveId: "salon:abc" } });
    expect(events[3]).toMatchObject({
      kind: "status",
      status: { messageId: "outbound-1", value: "failed", failureCode: "131047" },
    });
    expect(JSON.stringify(events)).not.toContain("base64");
  });

  it("ignores malformed messages without provider or sender identifiers", () => {
    const events = normalizeWhatsAppWebhook({
      entry: [{ changes: [{ value: { messages: [{ type: "text", text: { body: "x" } }] } }] }],
    });
    expect(events).toEqual([]);
  });
});
