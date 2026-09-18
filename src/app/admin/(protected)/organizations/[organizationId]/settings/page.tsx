import { notFound } from "next/navigation";

import { OrganizationSettingsClient } from "@/components/admin/organization-settings-client";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
  if (guard.error) notFound();
  return <OrganizationSettingsClient organizationId={organizationId} />;
}
