import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminIdentity } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminIdentity();
  let query = createSupabaseAdminClient()
    .from("organizations")
    .select("id,name,status,settings:organization_settings(simulator_enabled)")
    .order("name");
  if (!admin.isSystemAdmin) query = query.in("id", admin.organizationIds);
  const { data: organizations, error } = await query;
  if (error) throw error;
  return (
    <AdminShell
      admin={admin}
      organizations={organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        status: organization.status,
        simulatorEnabled: Boolean(organization.settings[0]?.simulator_enabled),
      }))}
    >
      {children}
    </AdminShell>
  );
}
