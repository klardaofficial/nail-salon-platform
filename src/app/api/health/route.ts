import { apiSuccess } from "@/lib/api/response";
import { getServerEnv, hasSupabaseConfig } from "@/lib/config/env";

export function GET() {
  const env = getServerEnv();
  return apiSuccess({
    status: "ok",
    environment: env.APP_ENV,
    databaseConfigured: hasSupabaseConfig(),
    revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  });
}
