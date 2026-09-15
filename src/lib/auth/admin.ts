import "server-only";

import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  email: string;
  displayName: string | null;
  mustChangePassword: boolean;
};

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id, display_name, active, must_change_password")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !admin) return null;

  return {
    id: authData.user.id,
    email: authData.user.email ?? "",
    displayName: admin.display_name,
    mustChangePassword: admin.must_change_password,
  };
}

export async function requireAdminIdentity(): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) redirect("/admin/login");
  return admin;
}
