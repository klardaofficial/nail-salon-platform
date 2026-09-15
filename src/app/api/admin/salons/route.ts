import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import {
  createResource,
  deactivateResource,
  listResource,
  updateResource,
} from "@/features/admin/resource-api";

export async function GET() {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await listResource("salons"));
  } catch (error) {
    return apiException(error);
  }
}
export async function POST(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await createResource("salons", await request.json()), { status: 201 });
  } catch (error) {
    return apiException(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await updateResource("salons", await request.json()));
  } catch (error) {
    return apiException(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    return apiSuccess(await deactivateResource("salons", await request.json()));
  } catch (error) {
    return apiException(error);
  }
}
