import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({
  getServerEnv: () => ({
    OPENAI_PRICING_JSON: { test: { kind: "chat_text", input: 1, cachedInput: 0.5, output: 2 } },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: mocks.insert, update: mocks.update }),
  }),
}));

import { aiPricingSchema, estimateAIUsageCost } from "./pricing";
import { summarizeChatUsage, summarizeImageUsage, withAIUsage } from "./record";

const context = {
  conversationId: "synthetic-conversation",
  channel: "whatsapp_simulator" as const,
  kind: "chat_text" as const,
  model: "test",
};
const summary = {
  status: "completed" as const,
  input_tokens: 1000,
  cached_input_tokens: 200,
  output_tokens: 100,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.finish.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.finish });
});

describe("AI usage pricing", () => {
  it("charges cached input once and includes output tokens", () => {
    expect(
      estimateAIUsageCost(summary, { kind: "chat_text", input: 1, cachedInput: 0.5, output: 2 }),
    ).toBe(0.0011);
    expect(
      estimateAIUsageCost(summary, { kind: "chat_text", input: 0, cachedInput: 0, output: 0 }),
    ).toBe(0);
  });
  it("keeps missing prices, tokens, and unsupported output modalities unknown", () => {
    expect(estimateAIUsageCost(summary, null)).toBeNull();
    expect(
      estimateAIUsageCost(
        { input_tokens: null, output_tokens: null },
        { kind: "chat_text", input: 1, cachedInput: 1, output: 1 },
      ),
    ).toBeNull();
    expect(
      estimateAIUsageCost(
        { ...summary, cached_input_tokens: 1001 },
        { kind: "chat_text", input: 1, cachedInput: 1, output: 1 },
      ),
    ).toBeNull();
    expect(
      estimateAIUsageCost(
        {
          input_tokens: 5,
          input_text_tokens: 2,
          input_image_tokens: 3,
          output_tokens: 4,
          output_image_tokens: 3,
          output_text_tokens: 1,
        },
        { kind: "image_generation", textInput: 1, imageInput: 2, imageOutput: 3 },
      ),
    ).toBeNull();
    expect(
      aiPricingSchema.safeParse({
        test: { kind: "chat_text", input: -1, cachedInput: 1, output: 1 },
      }).success,
    ).toBe(false);
    expect(
      aiPricingSchema.safeParse({
        test: { kind: "chat_text", input: Infinity, cachedInput: 1, output: 1 },
      }).success,
    ).toBe(false);
  });
  it("separates image and text input and counts outputs independently of delivery", () => {
    const usage = summarizeImageUsage({
      created: 0,
      data: [{}, {}],
      usage: {
        input_tokens: 5000,
        input_tokens_details: { text_tokens: 2000, image_tokens: 3000 },
        output_tokens: 4000,
        total_tokens: 9000,
      },
    });
    expect(usage.image_count).toBe(2);
    expect(
      estimateAIUsageCost(usage, {
        kind: "image_generation",
        textInput: 1,
        imageInput: 2,
        imageOutput: 3,
      }),
    ).toBe(0.02);
    expect(summarizeImageUsage({ created: 0, data: [{}] }).input_tokens).toBeNull();
  });
  it("keeps response-level failures and missing usage visible", () => {
    expect(
      summarizeChatUsage({ id: "response", status: "failed" } as OpenAIResponse),
    ).toMatchObject({ status: "failed", input_tokens: null, output_tokens: null });
  });
});

describe("durable AI usage recording", () => {
  it("stores a price snapshot and only allowlisted metadata, returning the original result", async () => {
    const result = { text: "Synthetic provider text" };
    expect(
      await withAIUsage(
        context,
        async () => result,
        () => summary,
      ),
    ).toBe(result);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "whatsapp_simulator",
        pricing: { kind: "chat_text", input: 1, cachedInput: 0.5, output: 2 },
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ input_tokens: 1000, estimated_cost_usd: 0.0011 }),
    );
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain(result.text);
    expect(mocks.finish).toHaveBeenCalledWith("id", mocks.insert.mock.calls[0][0].id);
  });
  it("records provider failures with unknown cost and no raw error text", async () => {
    const failure = new Error("Synthetic provider diagnostic");
    await expect(
      withAIUsage(
        context,
        () => Promise.reject(failure),
        () => summary,
      ),
    ).rejects.toBe(failure);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failure_code: "provider_request_failed" }),
    );
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain(failure.message);
  });
  it("does not call the provider if the initial durable record fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("Recording unavailable") });
    const request = vi.fn();
    await expect(withAIUsage(context, request, () => summary)).rejects.toThrow(
      "Recording unavailable",
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("does not retry a paid result when the completion write fails", async () => {
    mocks.finish.mockRejectedValue(new Error("Database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = vi.fn().mockResolvedValue("completed");
    expect(await withAIUsage(context, request, () => summary)).toBe("completed");
    expect(request).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("ai_usage_recording_failed", { usageId: expect.any(String) });
    log.mockRestore();
  });
  it("gives subsequent provider invocations independent usage records", async () => {
    await withAIUsage(
      context,
      async () => null,
      () => summary,
    );
    await withAIUsage(
      context,
      async () => null,
      () => summary,
    );
    expect(mocks.insert.mock.calls[0][0].id).not.toBe(mocks.insert.mock.calls[1][0].id);
  });
});
