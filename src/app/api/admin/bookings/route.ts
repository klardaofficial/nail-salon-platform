import { bookingFiltersSchema, queryAdminBookings } from "@/features/bookings/admin-query";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const filters = bookingFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return apiSuccess({ items: await queryAdminBookings(filters) });
  } catch (error) {
    return apiException(error);
  }
}
