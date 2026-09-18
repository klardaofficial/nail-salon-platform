import "server-only";

import type { ImagesResponse } from "openai/resources/images";
import type { Response } from "openai/resources/responses/responses";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { estimateAIUsageCost, type AIPricing, type AIUsage } from "./pricing";

type UsageSummary = AIUsage & {
  status: "completed" | "incomplete" | "failed";
  failure_code?: string;
  response_id?: string;
  provider_request_id?: string | null;
  image_count?: number;
};
type UsageContext = {
  organizationId: string;
  conversationId: string | null;
  previewRequestId?: string;
  channel: "whatsapp" | "whatsapp_simulator";
  kind: "chat_text" | "image_generation";
  model: string;
  pricing: Record<string, AIPricing>;
};

// The summarizer is an explicit allowlist. Never persist the SDK response itself.
export async function withAIUsage<T>(
  context: UsageContext,
  request: () => Promise<T>,
  summarize: (result: T) => UsageSummary,
): Promise<T> {
  const supabase = createSupabaseAdminClient();
  const configuredPrice = context.pricing[context.model];
  const pricing = configuredPrice?.kind === context.kind ? configuredPrice : null;
  const id = crypto.randomUUID();
  const started = await supabase.from("ai_usage_events").insert({
    id,
    organization_id: context.organizationId,
    conversation_id: context.conversationId,
    preview_request_id: context.previewRequestId ?? null,
    channel: context.channel,
    kind: context.kind,
    model: context.model,
    pricing,
  });
  if (started.error) throw started.error;

  async function finish(values: Record<string, unknown>) {
    try {
      const saved = await supabase
        .from("ai_usage_events")
        .update({ ...values, completed_at: new Date().toISOString() })
        .eq("id", id);
      if (saved.error) throw saved.error;
    } catch {
      // Preserve the durable 'started' row. A metrics write must not retry a paid request.
      console.error("ai_usage_recording_failed", { usageId: id });
    }
  }

  let result: T;
  try {
    result = await request();
  } catch (error) {
    await finish({ status: "failed", failure_code: "provider_request_failed" });
    throw error;
  }
  const usage = summarize(result);
  await finish({ ...usage, estimated_cost_usd: estimateAIUsageCost(usage, pricing) });
  return result;
}

export function summarizeChatUsage(
  response: Response & { _request_id?: string | null },
): UsageSummary {
  return {
    status:
      response.status === "completed"
        ? "completed"
        : response.status === "failed" || response.status === "cancelled"
          ? "failed"
          : "incomplete",
    ...(response.status === "failed" || response.status === "cancelled"
      ? { failure_code: "provider_response_failed" }
      : {}),
    response_id: response.id,
    provider_request_id: response._request_id,
    input_tokens: response.usage?.input_tokens ?? null,
    cached_input_tokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
    output_tokens: response.usage?.output_tokens ?? null,
    reasoning_tokens: response.usage?.output_tokens_details?.reasoning_tokens ?? null,
  };
}

export function summarizeImageUsage(
  response: ImagesResponse & { _request_id?: string | null },
): UsageSummary {
  const usage = response.usage;
  return {
    status: "completed",
    provider_request_id: response._request_id,
    input_tokens: usage?.input_tokens ?? null,
    input_text_tokens: usage?.input_tokens_details?.text_tokens ?? null,
    input_image_tokens: usage?.input_tokens_details?.image_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    // Images API output is image tokens unless it explicitly reports a mixed output.
    output_image_tokens: usage?.output_tokens_details?.image_tokens ?? usage?.output_tokens ?? null,
    output_text_tokens: usage ? (usage.output_tokens_details?.text_tokens ?? 0) : null,
    image_count: response.data?.length ?? 0,
  };
}
