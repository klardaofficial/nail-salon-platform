import { listSimulatorMessages, sendSimulatorMessage } from "@/features/simulator/service";
import { SimulatorIdentityError } from "@/features/simulator/identities";
import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { isWhatsAppSimulatorEnabled } from "@/lib/config/env";

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    if (!isWhatsAppSimulatorEnabled()) return apiError("not_found", "Simulator is disabled", 404);
    return apiSuccess(await listSimulatorMessages(new URL(request.url).searchParams.get("waId")), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    if (!isWhatsAppSimulatorEnabled()) return apiError("not_found", "Simulator is disabled", 404);
    const body: unknown = await request.json().catch(() => null);
    return apiSuccess(await sendSimulatorMessage(body), { status: 202 });
  } catch (error) {
    if (error instanceof SimulatorIdentityError)
      return apiError("identity_conflict", error.message, 409);
    return apiException(error);
  }
}
