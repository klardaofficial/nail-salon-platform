import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { listResource, updateResource } from "@/features/admin/resource-api";

export async function GET() {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await listResource("businesses"));
  } catch (error) {
    return apiException(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await updateResource("businesses", await request.json()));
  } catch (error) {
    return apiException(error);
  }
}
