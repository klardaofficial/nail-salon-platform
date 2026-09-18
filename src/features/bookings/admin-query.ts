import "server-only";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const bookingFiltersSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]).optional(),
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
) {
  const filters = bookingFiltersSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("bookings")
    .select(
      "id,status,starts_at,created_at,technician_name_snapshot,business_id,salon:salons!bookings_organization_salon_fkey(name),customer:contacts!bookings_organization_contact_fkey(display_name,wa_id),booking_services!booking_services_organization_booking_fkey(service_name_snapshot,position)",
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
    }[];
    return {
      id: booking.id,
      customerName:
        related(booking.customer, "display_name") ||
        related(booking.customer, "wa_id", "WhatsApp customer"),
      salonName: related(booking.salon, "name", "[N/A]"),
      services:
        serviceRows
          .sort((left, right) => left.position - right.position)
          .map((service) => service.service_name_snapshot)
          .join(", ") || "[N/A]",
      technicianName: booking.technician_name_snapshot,
      startsAt: booking.starts_at,
      status: booking.status,
      createdAt: booking.created_at,
    };
  });
}
