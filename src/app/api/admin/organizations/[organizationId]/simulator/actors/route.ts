import {
  isOrganizationSimulatorEnabled,
  listSimulatorIdentities,
} from "@/features/simulator/service";
import { resolveOpenAIConfiguration } from "@/features/organizations/providers";
import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId);
    if (guard.error) return guard.error;
    if (!(await isOrganizationSimulatorEnabled(organizationId)))
      return apiError("not_found", "Simulator is disabled", 404);
    return apiSuccess(
      {
        actors: await listSimulatorIdentities(organizationId),
        aiConfigured: Boolean(await resolveOpenAIConfiguration(organizationId)),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiException(error);
  }
}
