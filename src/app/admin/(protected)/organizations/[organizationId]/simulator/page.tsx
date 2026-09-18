import { notFound } from "next/navigation";

import { SimulatorClient } from "@/components/admin/simulator-client";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export default async function OrganizationSimulatorPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const guard = await requireOrganizationAdmin(organizationId);
  if (guard.error) notFound();
  return <SimulatorClient organizationId={organizationId} />;
}
