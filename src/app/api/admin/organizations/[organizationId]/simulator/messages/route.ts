import {
  isOrganizationSimulatorEnabled,
  listSimulatorMessages,
  sendSimulatorMessage,
} from "@/features/simulator/service";
import { SimulatorIdentityError } from "@/features/simulator/identities";
import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

type Context = { params: Promise<{ organizationId: string }> };
async function scope(context: Context) {
  const { organizationId } = await context.params;
  const guard = await requireOrganizationAdmin(organizationId);
  return { organizationId, ...guard };
}

export async function GET(request: Request, context: Context) {
  try {
    const guard = await scope(context);
    if (guard.error) return guard.error;
    if (!(await isOrganizationSimulatorEnabled(guard.organizationId)))
      return apiError("not_found", "Simulator is disabled", 404);
    return apiSuccess(
      await listSimulatorMessages(
        guard.organizationId,
        new URL(request.url).searchParams.get("waId"),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const guard = await scope(context);
    if (guard.error) return guard.error;
    if (!(await isOrganizationSimulatorEnabled(guard.organizationId)))
      return apiError("not_found", "Simulator is disabled", 404);
    const body: unknown = await request.json().catch(() => null);
    return apiSuccess(await sendSimulatorMessage(guard.organizationId, body), { status: 202 });
  } catch (error) {
    if (error instanceof SimulatorIdentityError)
      return apiError("identity_conflict", error.message, 409);
    return apiException(error);
  }
}
