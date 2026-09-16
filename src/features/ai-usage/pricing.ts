import { z } from "zod";

const rate = z.number().nonnegative();
export const aiPricingSchema = z.record(
  z.string().min(1),
  z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("chat_text"), input: rate, cachedInput: rate, output: rate }),
    z.strictObject({
      kind: z.literal("image_generation"),
      textInput: rate,
      imageInput: rate,
      imageOutput: rate,
      textOutput: rate.optional(),
    }),
  ]),
);
export type AIPricing = z.infer<typeof aiPricingSchema>[string];
export type AIUsage = {
  input_tokens: number | null;
  cached_input_tokens?: number | null;
  input_text_tokens?: number | null;
  input_image_tokens?: number | null;
  output_tokens: number | null;
  output_text_tokens?: number | null;
  output_image_tokens?: number | null;
  reasoning_tokens?: number | null;
};

export function estimateAIUsageCost(usage: AIUsage, pricing: AIPricing | null): number | null {
  if (!pricing || usage.input_tokens === null || usage.output_tokens === null) return null;
  let total: number;
  if (pricing.kind === "chat_text") {
    const cached = usage.cached_input_tokens;
    if (cached == null || cached > usage.input_tokens) return null;
    total =
      (usage.input_tokens - cached) * pricing.input +
      cached * pricing.cachedInput +
      usage.output_tokens * pricing.output;
  } else {
    const textInput = usage.input_text_tokens;
    const imageInput = usage.input_image_tokens;
    const textOutput = usage.output_text_tokens;
    const imageOutput = usage.output_image_tokens;
    if (textInput == null || imageInput == null || textOutput == null || imageOutput == null)
      return null;
    if (
      textInput + imageInput !== usage.input_tokens ||
      textOutput + imageOutput !== usage.output_tokens
    )
      return null;
    if (textOutput > 0 && pricing.textOutput === undefined) return null;
    total =
      textInput * pricing.textInput +
      imageInput * pricing.imageInput +
      textOutput * (pricing.textOutput ?? 0) +
      imageOutput * pricing.imageOutput;
  }
  return Number((total / 1_000_000).toFixed(10));
}
