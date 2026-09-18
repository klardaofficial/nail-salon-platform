import { notFound } from "next/navigation";

import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceName } from "@/features/admin/resources";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

const resources = new Set<ResourceName>(["salons", "services", "technicians"]);

export default async function OrganizationResourcePage({
  params,
}: {
  params: Promise<{ organizationId: string; resource: string }>;
}) {
  const { organizationId, resource } = await params;
  if (!resources.has(resource as ResourceName)) notFound();
  const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
  if (guard.error) notFound();
  return <ResourceManager organizationId={organizationId} resource={resource as ResourceName} />;
}
