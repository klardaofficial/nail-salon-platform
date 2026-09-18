import { z } from "zod";

import { apiException, apiSuccess } from "@/lib/api/response";
import { requireSystemAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildWebhookCallbackUrl } from "@/features/organizations/providers";

const schema = z.object({
  accessToken: z.string().nullable(),
  appSecret: z.string().nullable(),
  webhookVerifyToken: z.string().nullable(),
  confirmedTemplate: z.string().trim().max(512).nullable().optional(),
  cancelledTemplate: z.string().trim().max(512).nullable().optional(),
});
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const { data, error } = await createSupabaseAdminClient()
      .from("root_meta_settings")
      .select("*")
      .eq("singleton", true)
      .single();
    if (error) throw error;
    return apiSuccess(
      {
        accessToken: data.access_token,
        appSecret: data.app_secret,
        webhookVerifyToken: data.webhook_verify_token,
        confirmedTemplate: data.technician_booking_confirmed_template,
        cancelledTemplate: data.technician_booking_cancelled_template,
        callbackUrl: buildWebhookCallbackUrl(),
      },
      noStore,
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const values = schema.parse(await request.json());
    const credentials = [values.accessToken, values.appSecret, values.webhookVerifyToken].map(
      (value) => value?.trim() || null,
    );
    if (credentials.some(Boolean) && !credentials.every(Boolean))
      throw new Error("root_meta_bundle_must_be_complete");
    const supabase = createSupabaseAdminClient();
    const current = await supabase
      .from("root_meta_settings")
      .select("configuration_version")
      .eq("singleton", true)
      .single();
    if (current.error) throw current.error;
    const { error } = await supabase
      .from("root_meta_settings")
      .update({
        access_token: credentials[0],
        app_secret: credentials[1],
        webhook_verify_token: credentials[2],
        technician_booking_confirmed_template: values.confirmedTemplate || null,
        technician_booking_cancelled_template: values.cancelledTemplate || null,
        configuration_version: current.data.configuration_version + 1,
      })
      .eq("singleton", true);
    if (error) throw error;
    const inherited = await supabase
      .from("organization_provider_settings")
      .select("organization_id")
      .is("access_token", null)
      .is("app_secret", null)
      .is("webhook_verify_token", null);
    if (inherited.error) throw inherited.error;
    if (inherited.data.length) {
      const invalidated = await supabase
        .from("provider_configuration_validations")
        .delete()
        .in(
          "organization_id",
          inherited.data.map((item) => item.organization_id),
        );
      if (invalidated.error) throw invalidated.error;
    }
    return GET();
  } catch (error) {
    return apiException(error);
  }
}
