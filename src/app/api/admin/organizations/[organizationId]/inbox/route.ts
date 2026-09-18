import { threadsQuerySchema } from "@/features/inbox/contracts";
import { queryInboxThreads } from "@/features/inbox/query";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const query = threadsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await queryInboxThreads(organizationId, query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiException(error);
  }
}
