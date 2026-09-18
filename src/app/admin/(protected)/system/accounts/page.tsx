import { notFound } from "next/navigation";

import { SystemAccountsClient } from "@/components/admin/system-accounts-client";
import { requireSystemAdmin } from "@/lib/auth/api-admin";

export default async function SystemAccountsPage() {
  const guard = await requireSystemAdmin();
  if (guard.error) notFound();
  return <SystemAccountsClient />;
}
