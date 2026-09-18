import { z } from "zod";

import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireSystemAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aiPricingSchema } from "@/features/ai-usage/pricing";
import { buildWebhookCallbackUrl } from "@/features/organizations/providers";

const metaSchema = z.object({
  accessToken: z.string().nullable(),
  appSecret: z.string().nullable(),
  webhookVerifyToken: z.string().nullable(),
  confirmedTemplate: z.string().trim().max(512).nullable().optional(),
  cancelledTemplate: z.string().trim().max(512).nullable().optional(),
});
const openaiSchema = z.object({
  apiKey: z.string().nullable(),
  chatModel: z.string().trim().min(1).max(120),
  imageModel: z.string().trim().min(1).max(120),
  pricing: z.record(z.string(), z.unknown()),
});
const schema = z.object({
  meta: metaSchema.optional(),
  openai: openaiSchema.optional(),
});
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  try {
    const guard = await requireSystemAdmin();
    if (guard.error) return guard.error;
    const { data, error } = await createSupabaseAdminClient()
      .from("root_settings")
      .select("*")
      .eq("singleton", true)
      .single();
    if (error) throw error;
    return apiSuccess(
      {
        meta: {
          accessToken: data.access_token,
          appSecret: data.app_secret,
          webhookVerifyToken: data.webhook_verify_token,
          confirmedTemplate: data.technician_booking_confirmed_template,
          cancelledTemplate: data.technician_booking_cancelled_template,
          callbackUrl: buildWebhookCallbackUrl(),
        },
        openai: {
          apiKey: data.openai_api_key,
          chatModel: data.openai_chat_model,
          imageModel: data.openai_image_model,
          pricing: data.openai_pricing,
        },
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
    const supabase = createSupabaseAdminClient();
    const current = await supabase.from("root_settings").select("*").eq("singleton", true).single();
    if (current.error) throw current.error;

    if (values.meta) {
      const credentials = [
        values.meta.accessToken,
        values.meta.appSecret,
        values.meta.webhookVerifyToken,
      ].map((value) => value?.trim() || null);
      if (credentials.some(Boolean) && !credentials.every(Boolean)) {
        return apiError(
          "incomplete_meta_credentials",
          "Access token, app secret, and webhook verify token must all be filled in, or all left blank.",
          422,
        );
      }
      const confirmedTemplate = values.meta.confirmedTemplate?.trim() || null;
      const cancelledTemplate = values.meta.cancelledTemplate?.trim() || null;
      const credentialsChanged =
        credentials[0] !== current.data.access_token ||
        credentials[1] !== current.data.app_secret ||
        credentials[2] !== current.data.webhook_verify_token;
      const metaChanged =
        credentialsChanged ||
        confirmedTemplate !== current.data.technician_booking_confirmed_template ||
        cancelledTemplate !== current.data.technician_booking_cancelled_template;
      const updated = await supabase
        .from("root_settings")
        .update({
          access_token: credentials[0],
          app_secret: credentials[1],
          webhook_verify_token: credentials[2],
          technician_booking_confirmed_template: confirmedTemplate,
          technician_booking_cancelled_template: cancelledTemplate,
          ...(metaChanged ? { configuration_version: current.data.configuration_version + 1 } : {}),
        })
        .eq("singleton", true);
      if (updated.error) throw updated.error;
      if (credentialsChanged) {
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
      }
    }

    if (values.openai) {
      const apiKey = values.openai.apiKey?.trim() || null;
      if (apiKey) {
        const pricingParse = aiPricingSchema.safeParse(values.openai.pricing);
        if (!pricingParse.success) {
          const issue = pricingParse.error.issues[0];
          return apiError(
            "invalid_openai_pricing",
            `${issue.path.join(".")}: ${issue.message}`,
            422,
          );
        }
        const missingPricing = [values.openai.chatModel, values.openai.imageModel].filter(
          (model) => !pricingParse.data[model],
        );
        if (missingPricing.length) {
          return apiError(
            "incomplete_openai_pricing",
            `Add a pricing row for: ${missingPricing.join(", ")}`,
            422,
          );
        }
      }
      const openAIChanged =
        apiKey !== current.data.openai_api_key ||
        values.openai.chatModel !== current.data.openai_chat_model ||
        values.openai.imageModel !== current.data.openai_image_model ||
        JSON.stringify(values.openai.pricing) !== JSON.stringify(current.data.openai_pricing);
      const updated = await supabase
        .from("root_settings")
        .update({
          openai_api_key: apiKey,
          openai_chat_model: values.openai.chatModel,
          openai_image_model: values.openai.imageModel,
          openai_pricing: values.openai.pricing,
          ...(openAIChanged
            ? { openai_configuration_version: current.data.openai_configuration_version + 1 }
            : {}),
        })
        .eq("singleton", true);
      if (updated.error) throw updated.error;
    }

    return GET();
  } catch (error) {
    return apiException(error);
  }
}
