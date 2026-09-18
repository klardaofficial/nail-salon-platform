import { OrganizationsClient } from "@/components/admin/organizations-client";
import { requireAdminIdentity } from "@/lib/auth/admin";

export default async function AdminOverviewPage() {
  const admin = await requireAdminIdentity();
  return <OrganizationsClient canManage={admin.isSystemAdmin} />;
}
