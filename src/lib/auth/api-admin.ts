import "server-only";

import { getAdminIdentity } from "@/lib/auth/admin";
import { apiError } from "@/lib/api/response";

export async function requireApiAdmin() {
  const admin = await getAdminIdentity();
  if (!admin) {
    return {
      admin: null,
      error: apiError("unauthorized", "Administrator sign-in is required", 401),
    };
  }
  return { admin, error: null };
}
