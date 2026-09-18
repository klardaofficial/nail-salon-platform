import "server-only";

import type { AdminIdentity } from "@/features/admin/contracts";
import { hasSupabaseConfig } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id, display_name, active, must_change_password, is_system_admin")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !admin) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_admin_memberships")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("active", true);
  if (membershipError) return null;

  return {
    id: authData.user.id,
    email: authData.user.email ?? "",
    displayName: admin.display_name,
    mustChangePassword: admin.must_change_password,
    isSystemAdmin: admin.is_system_admin,
    organizationIds: memberships.map((membership) => membership.organization_id),
  };
}
