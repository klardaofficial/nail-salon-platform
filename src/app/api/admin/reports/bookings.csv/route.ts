import { bookingFiltersSchema, queryAdminBookings } from "@/features/bookings/admin-query";
import { requireApiAdmin } from "@/lib/auth/api-admin";

function csvCell(value: unknown) {
  let cell = String(value ?? "");
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const guard = await requireApiAdmin();
  if (guard.error) return guard.error;
  const filters = bookingFiltersSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const items = await queryAdminBookings(filters);
  const header = [
    "Booking ID",
    "Customer",
    "Salon",
    "Services",
    "Technician",
    "Start",
    "Status",
    "Created",
  ];
  const rows = items.map((item) => [
    item.id,
    item.customerName,
    item.salonName,
    item.services,
    item.technicianName ?? "[N/A]",
    item.startsAt,
    item.status,
    item.createdAt,
  ]);
  const body = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
