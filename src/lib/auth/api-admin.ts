import "server-only";

import { getAdminIdentity } from "@/lib/auth/admin";
import { apiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrganizationContext = {
  organizationId: string;
  organizationName: string;
  organizationStatus: "active" | "archived";
  businessId: string;
  adminId: string;
  isSystemAdmin: boolean;
};

export async function requireApiAdmin() {
  const admin = await getAdminIdentity();
  if (!admin) {
    return {
      admin: null,
      error: apiError("unauthorized", "Administrator sign-in is required", 401),
    };
  }
  return { admin, error: null };
}

export async function requireSystemAdmin() {
  const guard = await requireApiAdmin();
  if (guard.error) return guard;
  if (!guard.admin.isSystemAdmin) {
    return {
      admin: null,
      error: apiError("forbidden", "System administrator access is required", 403),
    };
  }
  return guard;
}

export async function requireOrganizationAdmin(
  organizationId: string,
  options: { allowArchivedRead?: boolean } = {},
): Promise<{ context: OrganizationContext | null; error: Response | null }> {
  const guard = await requireApiAdmin();
  if (guard.error) return { context: null, error: guard.error };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  ) {
    return {
      context: null,
      error: apiError("invalid_organization", "Organization ID is invalid", 400),
    };
  }
  if (!guard.admin.isSystemAdmin && !guard.admin.organizationIds.includes(organizationId)) {
    return {
      context: null,
      error: apiError("forbidden", "Organization access is not granted", 403),
    };
  }
  const supabase = createSupabaseAdminClient();
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id,name,status,businesses(id)")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!organization)
    return { context: null, error: apiError("not_found", "Organization was not found", 404) };
  if (organization.status === "archived" && !options.allowArchivedRead) {
    return {
      context: null,
      error: apiError("organization_archived", "Organization is archived", 409),
    };
  }
  const business = Array.isArray(organization.businesses)
    ? organization.businesses[0]
    : organization.businesses;
  if (!business) throw new Error("organization_business_missing");
  return {
    context: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationStatus: organization.status,
      businessId: business.id,
      adminId: guard.admin.id,
      isSystemAdmin: guard.admin.isSystemAdmin,
    },
    error: null,
  };
}
