import { activityQuerySchema, queryPlatformActivity } from "@/features/analytics/platform-query";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const query = activityQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await queryPlatformActivity(query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiException(error);
  }
}
