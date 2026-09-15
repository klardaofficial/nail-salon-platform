import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAdminConfig } from "@/lib/config/env";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = requireSupabaseAdminConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
