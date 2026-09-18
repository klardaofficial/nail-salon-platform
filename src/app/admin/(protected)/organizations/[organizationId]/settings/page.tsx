"use client";

import { useParams } from "next/navigation";

import { OrganizationSettingsClient } from "@/components/admin/organization-settings-client";

export default function OrganizationSettingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <OrganizationSettingsClient organizationId={organizationId} />;
}
