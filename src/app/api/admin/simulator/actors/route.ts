import { listSimulatorIdentities } from "@/features/simulator/service";
import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { getServerEnv, isWhatsAppSimulatorEnabled } from "@/lib/config/env";

export async function GET() {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    if (!isWhatsAppSimulatorEnabled()) return apiError("not_found", "Simulator is disabled", 404);
    return apiSuccess(
      {
        actors: await listSimulatorIdentities(),
        aiConfigured: Boolean(getServerEnv().OPENAI_API_KEY),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiException(error);
  }
}
