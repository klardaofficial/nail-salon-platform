import "server-only";

import { randomInt } from "node:crypto";

// Crockford-style alphabet: uppercase letters and digits, excluding easily
// confused characters (0/O, 1/I/L). The code travels through a customer's own
// typed/forwarded WhatsApp message, so it must stay readable and unambiguous.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// 5 bits/char * 13 chars = 65 bits, above the >=8-byte (64-bit) CSPRNG target.
// Matches the `code ~ '^[A-Z0-9]{8,16}$'` check constraint on booking_intents.
const CODE_LENGTH = 13;

const INTENT_TAG_PATTERN = /\[BK-([A-Z0-9]{8,16})\]/;

export function generateIntentCode(): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function formatIntentTag(code: string): string {
  return `[BK-${code}]`;
}

export function extractIntentCode(text: string): string | null {
  return text.match(INTENT_TAG_PATTERN)?.[1] ?? null;
}

export function stripIntentCode(text: string): string {
  return text.replace(INTENT_TAG_PATTERN, "").trim();
}
