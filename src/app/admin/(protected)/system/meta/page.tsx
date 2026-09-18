import { notFound } from "next/navigation";

import { SystemMetaClient } from "@/components/admin/system-meta-client";
import { requireSystemAdmin } from "@/lib/auth/api-admin";

export default async function SystemMetaPage() {
  const guard = await requireSystemAdmin();
  if (guard.error) notFound();
  return <SystemMetaClient />;
}
