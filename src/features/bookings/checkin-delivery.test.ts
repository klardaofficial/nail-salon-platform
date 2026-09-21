import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queue: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/messaging/outbox", () => ({ queueWhatsAppMessage: mocks.queue }));
vi.mock("@/lib/bot/static-messages", () => ({
  resolveStaticMessages: () => ({ checkinQrCaption: "Show this QR code on arrival." }),
}));

import { queueSimulatedCheckinQrDelivery } from "./checkin-delivery";

describe("queueSimulatedCheckinQrDelivery", () => {
  it("queues a captured, byte-free QR descriptor", async () => {
    mocks.queue.mockResolvedValue("outbox-id");

    await queueSimulatedCheckinQrDelivery({
      organizationId: "organization-id",
      bookingId: "booking-id",
      conversationId: "conversation-id",
      recipientWaId: "4915112345678",
      locale: "en",
    });

    expect(mocks.queue).toHaveBeenCalledWith({
      organizationId: "organization-id",
      conversationId: "conversation-id",
      recipientWaId: "4915112345678",
      payload: {
        kind: "image",
        mediaId: null,
        caption: "Show this QR code on arrival.",
        simulatorImage: { kind: "checkin_qr", bookingId: "booking-id" },
      },
      deduplicationKey: "booking:booking-id:checkin-qr",
      transport: "simulator",
    });
  });
});
