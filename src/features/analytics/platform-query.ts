import "server-only";

import { z } from "zod";
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
  organizationId: string,
  query: z.infer<typeof activityQuerySchema>,
): Promise<PlatformActivity> {
  const supabase = createSupabaseAdminClient();
  const settings = await supabase
    .from("organization_settings")
    .select("platform_timezone")
    .eq("organization_id", organizationId)
    .single();
  if (settings.error) throw settings.error;
  const timezone = settings.data.platform_timezone;
  const result = await supabase.rpc("admin_platform_activity", {
    p_organization_id: organizationId,
    p_from: query.from,
    p_to: query.to,
    p_timezone: timezone,
    p_channel: query.channel,
  });
  if (result.error) throw result.error;
  return { ...(result.data as Omit<PlatformActivity, "period">), period: { ...query, timezone } };
}

export async function queryAIUsage(
  organizationId: string,
  query: z.infer<typeof usageQuerySchema>,
): Promise<AIUsageLogs> {
  const supabase = createSupabaseAdminClient();
  const settings = await supabase
    .from("organization_settings")
    .select("platform_timezone")
    .eq("organization_id", organizationId)
    .single();
  if (settings.error) throw settings.error;
  const bounds = reportingBounds(query.from, query.to, settings.data.platform_timezone);
  const pageSize = 25;
  let request = supabase
    .from("ai_usage_events")
    .select(
      "id,started_at,completed_at,kind,model,channel,status,input_tokens,cached_input_tokens,input_text_tokens,input_image_tokens,output_tokens,image_count,estimated_cost_usd",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
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
