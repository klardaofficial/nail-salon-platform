import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/generated/database.types";
import { requireSupabaseAdminConfig } from "../src/lib/config/env";

const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const config = requireSupabaseAdminConfig();
const supabase = createClient<Database>(config.url, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const settings = await supabase
  .from("organization_settings")
  .select("legacy_environment_imported_at")
  .eq("organization_id", DEFAULT_ORGANIZATION_ID)
  .single();
if (settings.error) throw settings.error;
if (!settings.data.legacy_environment_imported_at) {
  const result = await supabase
    .from("organization_settings")
    .update({
      bot_locale: "de",
      platform_timezone: "Europe/Berlin",
      default_open_time: "09:00",
      default_close_time: "18:00",
      default_booking_interval_minutes: 30,
      preview_requests_per_day: 3,
      previews_per_request: 3,
      legacy_environment_imported_at: new Date().toISOString(),
    })
    .eq("organization_id", DEFAULT_ORGANIZATION_ID);
  if (result.error) throw result.error;
}

console.log("Organization bootstrap completed; existing database values were preserved.");
