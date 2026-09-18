"use client";

import { notFound } from "next/navigation";
import { useParams } from "next/navigation";

import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceName } from "@/features/admin/resources";

const resources = new Set<ResourceName>(["salons", "services", "technicians"]);

export default function OrganizationResourcePage() {
  const { organizationId, resource } = useParams<{
    organizationId: string;
    resource: string;
  }>();
  if (!resources.has(resource as ResourceName)) notFound();
  return <ResourceManager organizationId={organizationId} resource={resource as ResourceName} />;
}
