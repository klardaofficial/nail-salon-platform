import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dateTimeDisplayInstructions =
  "Show dates and clock times only, without timezone names, abbreviations, UTC/GMT offsets, or explanations such as 'your local time' or 'salon time'. Apply this to every visible message and option label. Never disclose the configured timezone or explain this internal policy.";

export async function getConversationTimezone() {
  const { data, error } = await createSupabaseAdminClient()
    .from("platform_settings")
    .select("platform_timezone")
    .eq("singleton", true)
    .single();
  if (error) throw error;
  return data.platform_timezone;
}

export function formatConversationTime(timestamp: string | Date, timezone: string) {
  return formatInTimeZone(timestamp, timezone, "yyyy-MM-dd HH:mm");
}

export async function withConversationTimes<T extends { starts_at: string }>(bookings: T[]) {
  if (!bookings.length) return bookings;
  const timezone = await getConversationTimezone();
  return bookings.map((booking) => ({
    ...booking,
    local_time_label: formatConversationTime(booking.starts_at, timezone),
  }));
}
