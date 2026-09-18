"use client";

import { useParams } from "next/navigation";

import { SimulatorClient } from "@/components/admin/simulator-client";

export default function OrganizationSimulatorPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <SimulatorClient organizationId={organizationId} />;
}
