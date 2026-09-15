import { AccountClient } from "@/components/admin/account-client";
import { requireAdminIdentity } from "@/lib/auth/admin";

export default async function AccountPage() {
  const admin = await requireAdminIdentity();
  return <AccountClient email={admin.email} mustChangePassword={admin.mustChangePassword} />;
}
