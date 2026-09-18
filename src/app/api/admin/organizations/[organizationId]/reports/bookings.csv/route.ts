import { bookingFiltersSchema, queryAdminBookings } from "@/features/bookings/admin-query";
import { apiException } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

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
    const csv = [
      [
        "Reference",
        "Customer",
        "Salon",
        "Services",
        "Technician",
        "Starts at",
        "Status",
        "Created at",
      ]
        .map(cell)
        .join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.customerName,
          row.salonName,
          row.services,
          row.technicianName,
          row.startsAt,
          row.status,
          row.createdAt,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\n");
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
