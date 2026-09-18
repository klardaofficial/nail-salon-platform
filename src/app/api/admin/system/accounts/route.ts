import { z } from "zod";

import { apiException, apiSuccess } from "@/lib/api/response";
import { requireSystemAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  initialPassword: z.string().min(8).max(128),
  isSystemAdmin: z.boolean().default(false),
  organizationIds: z.array(z.uuid()).max(100).default([]),
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reset_password"),
    userId: z.uuid(),
    password: z.string().min(8).max(128),
  }),
  z.object({ action: z.literal("set_system_role"), userId: z.uuid(), enabled: z.boolean() }),
  z.object({
    action: z.literal("set_memberships"),
    userId: z.uuid(),
    organizationIds: z.array(z.uuid()).max(100),
  }),
  z.object({ action: z.literal("remove"), userId: z.uuid() }),
]);

export async function GET() {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const supabase = createSupabaseAdminClient();
    const [accounts, memberships] = await Promise.all([
      supabase
        .from("platform_admins")
        .select("user_id,email,display_name,active,must_change_password,is_system_admin,created_at")
        .order("email")
        .limit(500),
      supabase.from("organization_admin_memberships").select("user_id,organization_id,active"),
    ]);
    if (accounts.error ?? memberships.error) throw accounts.error ?? memberships.error;
    return apiSuccess(
      {
        accounts: accounts.data.map((account) => ({
          ...account,
          organizationIds: memberships.data
            .filter((item) => item.user_id === account.user_id && item.active)
            .map((item) => item.organization_id),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const values = createSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const created = await supabase.auth.admin.createUser({
      email: values.email,
      password: values.initialPassword,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    const userId = created.data.user.id;
    try {
      const profile = await supabase.from("platform_admins").insert({
        user_id: userId,
        email: values.email,
        display_name: values.displayName ?? null,
        is_system_admin: values.isSystemAdmin,
        must_change_password: true,
      });
      if (profile.error) throw profile.error;
      if (values.organizationIds.length) {
        const memberships = await supabase.from("organization_admin_memberships").insert(
          values.organizationIds.map((organizationId) => ({
            organization_id: organizationId,
            user_id: userId,
          })),
        );
        if (memberships.error) throw memberships.error;
      }
    } catch (error) {
      await supabase.auth.admin.deleteUser(userId);
      throw error;
    }
    return apiSuccess({ userId }, { status: 201 });
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const values = actionSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    if (values.action === "reset_password") {
      const auth = await supabase.auth.admin.updateUserById(values.userId, {
        password: values.password,
      });
      if (auth.error) throw auth.error;
      const profile = await supabase
        .from("platform_admins")
        .update({ must_change_password: true })
        .eq("user_id", values.userId);
      if (profile.error) throw profile.error;
    } else if (values.action === "set_system_role") {
      const result = await supabase.rpc("set_system_admin_role", {
        p_user_id: values.userId,
        p_is_system_admin: values.enabled,
      });
      if (result.error) throw result.error;
    } else if (values.action === "set_memberships") {
      const disabled = await supabase
        .from("organization_admin_memberships")
        .update({ active: false })
        .eq("user_id", values.userId);
      if (disabled.error) throw disabled.error;
      if (values.organizationIds.length) {
        const memberships = await supabase.from("organization_admin_memberships").upsert(
          values.organizationIds.map((organizationId) => ({
            organization_id: organizationId,
            user_id: values.userId,
            active: true,
          })),
        );
        if (memberships.error) throw memberships.error;
      }
    } else {
      const deactivated = await supabase.rpc("deactivate_platform_admin", {
        p_user_id: values.userId,
      });
      if (deactivated.error) throw deactivated.error;
      const auth = await supabase.auth.admin.updateUserById(values.userId, {
        ban_duration: "876000h",
      });
      if (auth.error) throw auth.error;
    }
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiException(error);
  }
}
