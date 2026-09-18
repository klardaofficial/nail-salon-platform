import { notFound } from "next/navigation";

import { DashboardClient } from "@/components/admin/dashboard-client";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function OrganizationAnalyticsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
  if (guard.error) notFound();
  const settings = await createSupabaseAdminClient()
    .from("organization_settings")
    .select("simulator_enabled")
    .eq("organization_id", organizationId)
    .single();
  if (settings.error) throw settings.error;
  return (
    <DashboardClient
      organizationId={organizationId}
      simulatorEnabled={settings.data.simulator_enabled}
    />
  );
}
