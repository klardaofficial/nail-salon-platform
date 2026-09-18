import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const { data, error } = await createSupabaseAdminClient()
      .from("organization_admin_memberships")
      .select("created_at,admin:platform_admins!inner(user_id,email,display_name,active)")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at");
    if (error) throw error;
    return apiSuccess({ members: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiException(error);
  }
}
