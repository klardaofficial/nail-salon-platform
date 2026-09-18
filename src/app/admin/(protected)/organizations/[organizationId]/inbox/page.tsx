"use client";

import { useParams } from "next/navigation";

import { InboxClient } from "@/components/admin/inbox-client";

export default function OrganizationInboxPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <InboxClient organizationId={organizationId} />;
}
