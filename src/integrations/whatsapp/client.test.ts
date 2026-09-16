import { describe, expect, it } from "vitest";

import { WHATSAPP_API_VERSION } from "./client";

describe("WhatsApp Graph client", () => {
  it("pins requests to Graph API v26.0", () => {
    expect(WHATSAPP_API_VERSION).toBe("v26.0");
  });
});
