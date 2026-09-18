"use client";

import { useParams } from "next/navigation";

import { OrganizationAccountsClient } from "@/components/admin/organization-accounts-client";

export default function OrganizationAccountsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <OrganizationAccountsClient organizationId={organizationId} />;
}
