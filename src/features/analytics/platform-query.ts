import "server-only";

import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  reportingBounds,
  reportingFields,
  reportingRangeMessage,
  validReportingRange,
} from "./period";
import type { AIUsageLogs, PlatformActivity } from "./platform-types";

export const activityFields = {
  ...reportingFields,
  channel: z.enum(["whatsapp", "whatsapp_simulator", "all"]).default("whatsapp"),
};
export const activityQuerySchema = z
  .object(activityFields)
  .refine(validReportingRange, { message: reportingRangeMessage });
export const usageQuerySchema = z
  .object({
    ...activityFields,
    page: z.coerce.number().int().min(1).max(100000).default(1),
    kind: z.enum(["all", "chat_text", "image_generation"]).default("all"),
  })
  .refine(validReportingRange, { message: reportingRangeMessage });

export async function queryPlatformActivity(
  query: z.infer<typeof activityQuerySchema>,
): Promise<PlatformActivity> {
  const timezone = getServerEnv().PLATFORM_TIMEZONE;
  const result = await createSupabaseAdminClient().rpc("admin_platform_activity", {
    p_from: query.from,
    p_to: query.to,
    p_timezone: timezone,
    p_channel: query.channel,
  });
  if (result.error) throw result.error;
  return { ...(result.data as Omit<PlatformActivity, "period">), period: { ...query, timezone } };
}

export async function queryAIUsage(query: z.infer<typeof usageQuerySchema>): Promise<AIUsageLogs> {
  const bounds = reportingBounds(query.from, query.to, getServerEnv().PLATFORM_TIMEZONE);
  const pageSize = 25;
  let request = createSupabaseAdminClient()
    .from("ai_usage_events")
    .select(
      "id,started_at,completed_at,kind,model,channel,status,input_tokens,cached_input_tokens,input_text_tokens,input_image_tokens,output_tokens,image_count,estimated_cost_usd",
      { count: "exact" },
    )
    .gte("started_at", bounds.start)
    .lt("started_at", bounds.end)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range((query.page - 1) * pageSize, query.page * pageSize - 1);
  if (query.channel !== "all") request = request.eq("channel", query.channel);
  if (query.kind !== "all") request = request.eq("kind", query.kind);
  const result = await request;
  if (result.error) throw result.error;
  return { items: result.data as AIUsageLogs["items"], total: result.count ?? 0, pageSize };
}
