import { z } from "zod";

import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12),
    confirmPassword: z.string().min(12),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current password",
  });

export async function PATCH(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const values = passwordSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { error: verificationError } = await supabase.auth.signInWithPassword({
      email: guard.admin.email,
      password: values.currentPassword,
    });
    if (verificationError) {
      return apiError("current_password_invalid", "The current password is incorrect", 400);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.newPassword,
    });
    if (updateError) throw updateError;

    const adminClient = createSupabaseAdminClient();
    const { error: flagError } = await adminClient
      .from("platform_admins")
      .update({ must_change_password: false })
      .eq("user_id", guard.admin.id);
    if (flagError) throw flagError;
    await adminClient.from("audit_log").insert({
      actor_type: "platform_admin",
      actor_id: guard.admin.id,
      action: "platform_admin.password_changed",
      entity_type: "platform_admin",
      entity_id: guard.admin.id,
    });

    await supabase.auth.signOut({ scope: "others" });
    return apiSuccess({ changed: true });
  } catch (error) {
    return apiException(error);
  }
}
