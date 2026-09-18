import { apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";

export async function GET() {
  const guard = await requireApiAdmin();
  if (guard.error) return guard.error;
  return apiSuccess(guard.admin, { headers: { "Cache-Control": "private, no-store" } });
}
