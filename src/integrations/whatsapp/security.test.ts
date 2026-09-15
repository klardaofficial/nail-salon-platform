import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyWebhookChallenge, verifyWhatsAppSignature } from "./security";

describe("WhatsApp webhook security", () => {
  it("accepts only an exact HMAC signature", () => {
    const body = '{"event":"example"}';
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true);
    expect(verifyWhatsAppSignature(`${body}x`, signature, secret)).toBe(false);
    expect(verifyWhatsAppSignature(body, "sha256=00", secret)).toBe(false);
  });

  it("requires subscribe mode and the configured challenge token", () => {
    expect(verifyWebhookChallenge("subscribe", "token", "token")).toBe(true);
    expect(verifyWebhookChallenge("subscribe", "wrong", "token")).toBe(false);
    expect(verifyWebhookChallenge("unsubscribe", "token", "token")).toBe(false);
  });
});
