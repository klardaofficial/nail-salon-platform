"use client";

import { useParams } from "next/navigation";

import { DashboardClient } from "@/components/admin/dashboard-client";

export default function OrganizationOverviewPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <DashboardClient organizationId={organizationId} />;
}
