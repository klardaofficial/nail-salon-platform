import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/generated/database.types";
import { getBootstrapEnv, requireSupabaseAdminConfig } from "../src/lib/config/env";

const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const config = requireSupabaseAdminConfig();
const env = getBootstrapEnv();
const supabase = createClient<Database>(config.url, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const provider = await supabase
  .from("organization_provider_settings")
  .select("*")
  .eq("organization_id", DEFAULT_ORGANIZATION_ID)
  .single();
if (provider.error) throw provider.error;
const providerUpdate = {
  ...(!provider.data.openai_api_key && env.OPENAI_API_KEY
    ? { openai_api_key: env.OPENAI_API_KEY }
    : {}),
  ...(!provider.data.openai_chat_model ? { openai_chat_model: env.OPENAI_CHAT_MODEL } : {}),
  ...(!provider.data.openai_image_model ? { openai_image_model: env.OPENAI_IMAGE_MODEL } : {}),
  ...(Object.keys(provider.data.openai_pricing ?? {}).length === 0
    ? { openai_pricing: env.OPENAI_PRICING_JSON }
    : {}),
};
if (Object.keys(providerUpdate).length) {
  const result = await supabase
    .from("organization_provider_settings")
    .update({
      ...providerUpdate,
      configuration_version: provider.data.configuration_version + 1,
      openai_configuration_version: provider.data.openai_configuration_version + 1,
    })
    .eq("organization_id", DEFAULT_ORGANIZATION_ID);
  if (result.error) throw result.error;
  const invalidated = await supabase
    .from("provider_configuration_validations")
    .delete()
    .eq("organization_id", DEFAULT_ORGANIZATION_ID);
  if (invalidated.error) throw invalidated.error;
}

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
