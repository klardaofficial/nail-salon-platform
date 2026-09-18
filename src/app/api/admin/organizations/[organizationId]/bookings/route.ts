import { bookingFiltersSchema, queryAdminBookings } from "@/features/bookings/admin-query";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
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
    const effectiveFilters = settings.data.simulator_enabled
      ? filters
      : { ...filters, source: "real" as const };
    return apiSuccess({
      items: await queryAdminBookings(organizationId, effectiveFilters),
      simulatorEnabled: settings.data.simulator_enabled,
      source: effectiveFilters.source,
    });
  } catch (error) {
    return apiException(error);
  }
}
