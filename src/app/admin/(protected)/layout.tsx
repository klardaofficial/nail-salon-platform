import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminIdentity } from "@/lib/auth/admin";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminIdentity();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
