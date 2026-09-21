import { bookingFiltersSchema, queryAdminBookings } from "@/features/bookings/admin-query";
import { apiException } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { csvDocument } from "@/lib/csv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const settings = await createSupabaseAdminClient()
      .from("organization_settings")
      .select("simulator_enabled")
      .eq("organization_id", organizationId)
      .single();
    if (settings.error) throw settings.error;
    const filters = bookingFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const rows = await queryAdminBookings(
      organizationId,
      settings.data.simulator_enabled ? filters : { ...filters, source: "real" },
    );
    const csv = csvDocument([
      [
        "Reference",
        "Customer",
        "Customer WhatsApp",
        "Salon",
        "Salon location",
        "Services",
        "Technician",
        "Starts at",
        "Booked local time",
        "Timezone",
        "Additional request",
        "Status",
        "Cancelled at",
        "Cancellation reason",
        "Checked in at",
        "Source",
        "Created at",
        "Updated at",
      ],
      ...rows.map((row) => [
        row.id,
        row.customerName,
        row.customerWhatsapp,
        row.salonName,
        row.salonLocation,
        row.serviceDetails
          .map((service) => (service.custom ? `${service.name} (custom)` : service.name))
          .join("; "),
        row.technicianName,
        row.startsAt,
        row.localTimeLabel,
        row.timezone,
        row.additionalRequest,
        row.status,
        row.cancelledAt,
        row.cancellationReason,
        row.checkedInAt,
        row.simulated ? "Simulator" : "Real",
        row.createdAt,
        row.updatedAt,
      ]),
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bookings.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiException(error);
  }
}
