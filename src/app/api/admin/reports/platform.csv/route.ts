import { platformActivityCsv } from "@/features/analytics/platform-csv";
import { activityQuerySchema, queryPlatformActivity } from "@/features/analytics/platform-query";
import { apiException } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const query = activityQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const data = await queryPlatformActivity(query);
    return new Response(platformActivityCsv(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="platform-${query.from}-${query.to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiException(error);
  }
}
