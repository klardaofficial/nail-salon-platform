import { z } from "zod";

import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const credentials = loginSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const signIn = await supabase.auth.signInWithPassword(credentials);
    if (signIn.error || !signIn.data.user) {
      return apiError("invalid_credentials", "Email or password is incorrect", 401);
    }

    const { data: admin } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", signIn.data.user.id)
      .eq("active", true)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      return apiError("admin_access_required", "This account is not a platform administrator", 403);
    }

    return apiSuccess({ signedIn: true });
  } catch (error) {
    return apiException(error);
  }
}
