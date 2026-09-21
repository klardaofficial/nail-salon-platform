import "server-only";

import { z } from "zod";

import type { AdminBookingRow, AdminBookingService } from "@/features/bookings/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const bookingFiltersSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "checked_in"]).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  source: z.enum(["real", "simulator", "both"]).default("real"),
});

function related(value: unknown, key: string, fallback = "") {
  if (Array.isArray(value)) {
    return String((value[0] as Record<string, unknown> | undefined)?.[key] ?? fallback);
  }
  if (value && typeof value === "object") {
    return String((value as Record<string, unknown>)[key] ?? fallback);
  }
  return fallback;
}

export async function queryAdminBookings(
  organizationId: string,
  input: z.input<typeof bookingFiltersSchema>,
): Promise<AdminBookingRow[]> {
  const filters = bookingFiltersSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("bookings")
    .select(
      "id,status,starts_at,local_time_label,timezone_snapshot,additional_request,cancelled_at,cancellation_reason,checked_in_at,simulated,created_at,updated_at,technician_name_snapshot,business_id,salon:salons!bookings_organization_salon_fkey(name,location_label),customer:contacts!bookings_organization_contact_fkey(display_name,wa_id),booking_services!booking_services_organization_booking_fkey(service_name_snapshot,position,service_id)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.source !== "both") query = query.eq("simulated", filters.source === "simulator");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((booking) => {
    const serviceRows = (booking.booking_services ?? []) as {
      service_name_snapshot: string;
      position: number;
      service_id: string | null;
    }[];
    const serviceDetails: AdminBookingService[] = serviceRows
      .sort((left, right) => left.position - right.position)
      .map((service) => ({
        name: service.service_name_snapshot,
        position: service.position,
        custom: service.service_id === null,
      }));
    return {
      id: booking.id,
      customerName:
        related(booking.customer, "display_name") ||
        related(booking.customer, "wa_id", "WhatsApp customer"),
      customerWhatsapp: related(booking.customer, "wa_id", "[N/A]"),
      salonName: related(booking.salon, "name", "[N/A]"),
      salonLocation: related(booking.salon, "location_label", "[N/A]"),
      services: serviceDetails.map((service) => service.name).join(", ") || "[N/A]",
      serviceDetails,
      technicianName: booking.technician_name_snapshot,
      startsAt: booking.starts_at,
      localTimeLabel: booking.local_time_label,
      timezone: booking.timezone_snapshot,
      additionalRequest: booking.additional_request,
      status: booking.status,
      cancelledAt: booking.cancelled_at,
      cancellationReason: booking.cancellation_reason,
      checkedInAt: booking.checked_in_at,
      simulated: booking.simulated,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
    };
  });
}
