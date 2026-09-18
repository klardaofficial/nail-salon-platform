import { notFound } from "next/navigation";

import { OrganizationAccountsClient } from "@/components/admin/organization-accounts-client";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export default async function OrganizationAccountsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
  if (guard.error) notFound();
  return <OrganizationAccountsClient organizationId={organizationId} />;
}
