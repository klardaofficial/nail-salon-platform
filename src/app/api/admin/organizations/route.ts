import { z } from "zod";

import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin, requireSystemAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    const limit = Math.min(
      500,
      Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 30),
    );
    let query = createSupabaseAdminClient()
      .from("organizations")
      .select(
        "id,name,status,created_at,businesses(name),settings:organization_settings(simulator_enabled)",
        { count: "exact" },
      )
      .order("name")
      .range((page - 1) * limit, page * limit - 1);
    if (!guard.admin.isSystemAdmin) query = query.in("id", guard.admin.organizationIds);
    const { data, count, error } = await query;
    if (error) throw error;
    return apiSuccess({
      organizations: data.map(({ settings, ...organization }) => ({
        ...organization,
        simulatorEnabled: Boolean(settings[0]?.simulator_enabled),
      })),
      page,
      pageSize: limit,
      total: count ?? 0,
    });
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const { name } = z
      .object({ name: z.string().trim().min(1).max(120) })
      .parse(await request.json());
    const { data, error } = await createSupabaseAdminClient().rpc("create_organization", {
      p_name: name,
    });
    if (error) throw error;
    return apiSuccess({ id: data }, { status: 201 });
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const values = z.object({ id: z.uuid(), archived: z.boolean() }).parse(await request.json());
    const { data, error } = await createSupabaseAdminClient()
      .from("organizations")
      .update(
        values.archived
          ? {
              status: "archived",
              archived_at: new Date().toISOString(),
              archived_by: guard.admin.id,
            }
          : { status: "active", archived_at: null, archived_by: null },
      )
      .eq("id", values.id)
      .select("id,name,status")
      .single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (error) {
    return apiException(error);
  }
}
