import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractIntentCode, formatIntentTag, generateIntentCode, stripIntentCode } from "./code";

describe("generateIntentCode", () => {
  it("generates a 13-character code drawn from the unambiguous 32-symbol alphabet", () => {
    const code = generateIntentCode();
    expect(code).toHaveLength(13);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{13}$/);
    // Excludes visually-ambiguous characters (0/O, 1/I/L) from the alphabet.
    expect(code).not.toMatch(/[01ILO]/);
  });

  it("generates distinct codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateIntentCode()));
    expect(codes.size).toBe(20);
  });
});

describe("formatIntentTag / extractIntentCode / stripIntentCode", () => {
  it("round-trips a generated code through the tag", () => {
    const code = generateIntentCode();
    const tag = formatIntentTag(code);
    expect(tag).toBe(`[BK-${code}]`);
    expect(extractIntentCode(tag)).toBe(code);
  });

  it("extracts the code from a full prefill message and strips it from customer text", () => {
    const code = generateIntentCode();
    const message = `${formatIntentTag(code)} I'd like to book a manicure tomorrow at 3pm.`;
    expect(extractIntentCode(message)).toBe(code);
    expect(stripIntentCode(message)).toBe("I'd like to book a manicure tomorrow at 3pm.");
  });

  it("returns null and leaves text untouched when no tag is present", () => {
    expect(extractIntentCode("just a normal message")).toBeNull();
    expect(stripIntentCode("just a normal message")).toBe("just a normal message");
  });

  it("does not match malformed or wrong-length tags", () => {
    expect(extractIntentCode("[BK-short]")).toBeNull();
    expect(extractIntentCode("[BK-lowercase1234]")).toBeNull();
    expect(extractIntentCode("[bk-ABCDEFGH1234]")).toBeNull();
  });
});
