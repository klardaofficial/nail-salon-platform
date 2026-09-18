import { notFound } from "next/navigation";

import { BookingsClient } from "@/components/admin/bookings-client";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export default async function OrganizationBookingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
  if (guard.error) notFound();
  return <BookingsClient organizationId={organizationId} />;
}
