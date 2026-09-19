"use client";

import { useParams } from "next/navigation";

import { SimulatorTabs } from "@/components/admin/simulator-tabs";

export default function OrganizationSimulatorPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <SimulatorTabs organizationId={organizationId} />;
}
