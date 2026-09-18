"use client";

import { useParams } from "next/navigation";

import { BookingsClient } from "@/components/admin/bookings-client";

export default function OrganizationBookingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <BookingsClient organizationId={organizationId} />;
}
