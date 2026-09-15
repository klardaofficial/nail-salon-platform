import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWhatsAppSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyWebhookChallenge(
  mode: string | null,
  suppliedToken: string | null,
  expectedToken: string,
) {
  return mode === "subscribe" && Boolean(suppliedToken) && suppliedToken === expectedToken;
}
