import { apiException, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return apiSuccess({ signedOut: true });
  } catch (error) {
    return apiException(error);
  }
}
