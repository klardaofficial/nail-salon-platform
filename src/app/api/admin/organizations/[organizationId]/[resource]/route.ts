import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import {
  createResource,
  deactivateResource,
  listResource,
  updateResource,
} from "@/features/admin/resource-api";
import type { ResourceName } from "@/features/admin/resources";

const resources = new Set<ResourceName>(["salons", "services", "technicians"]);
type Context = { params: Promise<{ organizationId: string; resource: string }> };

async function scope(context: Context, allowArchivedRead = false) {
  const params = await context.params;
  if (!resources.has(params.resource as ResourceName)) {
    return { params, context: null, error: apiError("not_found", "Resource was not found", 404) };
  }
  const guard = await requireOrganizationAdmin(params.organizationId, { allowArchivedRead });
  return { params, ...guard };
}

export async function GET(_request: Request, routeContext: Context) {
  try {
    const guard = await scope(routeContext, true);
    if (guard.error) return guard.error;
    return apiSuccess(
      await listResource(guard.context!.organizationId, guard.params.resource as ResourceName),
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request, routeContext: Context) {
  try {
    const guard = await scope(routeContext);
    if (guard.error) return guard.error;
    return apiSuccess(
      await createResource(
        guard.context!.organizationId,
        guard.params.resource as ResourceName,
        await request.json(),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request, routeContext: Context) {
  try {
    const guard = await scope(routeContext);
    if (guard.error) return guard.error;
    return apiSuccess(
      await updateResource(
        guard.context!.organizationId,
        guard.params.resource as ResourceName,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function DELETE(request: Request, routeContext: Context) {
  try {
    const guard = await scope(routeContext);
    if (guard.error) return guard.error;
    return apiSuccess(
      await deactivateResource(
        guard.context!.organizationId,
        guard.params.resource as ResourceName,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiException(error);
  }
}
