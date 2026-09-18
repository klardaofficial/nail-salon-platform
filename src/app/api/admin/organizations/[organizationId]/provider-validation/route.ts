import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { validateOrganizationProviderConfiguration } from "@/features/organizations/providers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId);
    if (guard.error) return guard.error;
    return apiSuccess(await validateOrganizationProviderConfiguration(organizationId));
  } catch (error) {
    return apiException(error);
  }
}
