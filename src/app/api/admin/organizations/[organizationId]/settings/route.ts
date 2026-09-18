import { z } from "zod";

import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  clickToChatUrl,
  resolveEffectiveMetaConfiguration,
  resolveOpenAIConfiguration,
} from "@/features/organizations/providers";
import {
  readOrganizationProfile,
  updateOrganizationProfile,
} from "@/features/organizations/profile";
import { languageCodeSchema } from "@/lib/bot/language";
import { isValidTimeZone } from "@/lib/timezones";

type Context = { params: Promise<{ organizationId: string }> };
const metaFields = z.object({
  accessToken: z.string().nullable(),
  appSecret: z.string().nullable(),
  webhookVerifyToken: z.string().nullable(),
});
const updateSchema = z.object({
  organizationName: z.string().trim().min(1).max(120).optional(),
  ownerWaIds: z.string().max(2000).optional(),
  platformTimezone: z.string().trim().min(1).max(80).refine(isValidTimeZone).optional(),
  botLocale: languageCodeSchema.optional(),
  simulatorEnabled: z.boolean().optional(),
  wabaId: z.string().trim().max(128).nullable().optional(),
  phoneNumberId: z.string().trim().max(128).nullable().optional(),
  meta: metaFields.optional(),
  confirmedTemplate: z.string().trim().max(512).nullable().optional(),
  cancelledTemplate: z.string().trim().max(512).nullable().optional(),
  openaiApiKey: z.string().trim().min(1).optional(),
  openaiChatModel: z.string().trim().min(1).max(120).optional(),
  openaiImageModel: z.string().trim().min(1).max(120).optional(),
  openaiPricing: z.record(z.string(), z.unknown()).optional(),
});

const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const supabase = createSupabaseAdminClient();
    const [
      { data: settings, error: settingsError },
      { data: provider, error: providerError },
      effective,
      openAI,
      profile,
    ] = await Promise.all([
      supabase
        .from("organization_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),
      supabase
        .from("organization_provider_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .single(),
      resolveEffectiveMetaConfiguration(organizationId),
      resolveOpenAIConfiguration(organizationId),
      readOrganizationProfile(organizationId),
    ]);
    if (settingsError ?? providerError) throw settingsError ?? providerError;
    const qrAvailable = effective?.readiness === "enabled" && Boolean(effective.e164Digits);
    return apiSuccess(
      {
        organization: {
          id: organizationId,
          name: guard.context!.organizationName,
          status: guard.context!.organizationStatus,
          ownerWaIds: profile.ownerWaIds,
        },
        settings,
        provider: {
          wabaId: provider.waba_id,
          phoneNumberId: provider.phone_number_id,
          savedMetaOverride: {
            accessToken: provider.access_token,
            appSecret: provider.app_secret,
            webhookVerifyToken: provider.webhook_verify_token,
          },
          confirmedTemplate: provider.technician_booking_confirmed_template,
          cancelledTemplate: provider.technician_booking_cancelled_template,
          openaiConfigured: Boolean(openAI),
          openaiChatModel: provider.openai_chat_model,
          openaiImageModel: provider.openai_image_model,
          source: effective?.source ?? "none",
          readiness: effective?.readiness ?? "incomplete",
          callbackUrl: effective?.callbackUrl,
          displayPhoneNumber: qrAvailable ? effective?.displayPhoneNumber : null,
          clickToChatUrl: qrAvailable ? clickToChatUrl(effective!.e164Digits!) : null,
          templates: effective?.templates,
        },
      },
      noStore,
    );
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId);
    if (guard.error) return guard.error;
    const values = updateSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    if (values.organizationName !== undefined || values.ownerWaIds !== undefined) {
      await updateOrganizationProfile(organizationId, values);
    }
    const settingsValues = {
      ...(values.platformTimezone !== undefined
        ? { platform_timezone: values.platformTimezone }
        : {}),
      ...(values.botLocale !== undefined ? { bot_locale: values.botLocale } : {}),
      ...(values.simulatorEnabled !== undefined
        ? { simulator_enabled: values.simulatorEnabled }
        : {}),
    };
    if (Object.keys(settingsValues).length) {
      const result = await supabase
        .from("organization_settings")
        .update(settingsValues)
        .eq("organization_id", organizationId);
      if (result.error) throw result.error;
    }
    const current = await supabase
      .from("organization_provider_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .single();
    if (current.error) throw current.error;
    const providerValues: Record<string, unknown> = {};
    const normalizedMeta = values.meta
      ? Object.fromEntries(
          Object.entries(values.meta).map(([key, value]) => [key, value?.trim() || null]),
        )
      : null;
    if (normalizedMeta) {
      const metaValues = Object.values(normalizedMeta);
      if (metaValues.some(Boolean) && !metaValues.every(Boolean))
        throw new Error("meta_override_must_be_complete");
      providerValues.access_token = normalizedMeta.accessToken;
      providerValues.app_secret = normalizedMeta.appSecret;
      providerValues.webhook_verify_token = normalizedMeta.webhookVerifyToken;
    }
    if (values.wabaId !== undefined) providerValues.waba_id = values.wabaId || null;
    if (values.phoneNumberId !== undefined)
      providerValues.phone_number_id = values.phoneNumberId || null;
    if (values.confirmedTemplate !== undefined)
      providerValues.technician_booking_confirmed_template = values.confirmedTemplate || null;
    if (values.cancelledTemplate !== undefined)
      providerValues.technician_booking_cancelled_template = values.cancelledTemplate || null;
    if (values.openaiApiKey !== undefined) providerValues.openai_api_key = values.openaiApiKey;
    if (values.openaiChatModel !== undefined)
      providerValues.openai_chat_model = values.openaiChatModel;
    if (values.openaiImageModel !== undefined)
      providerValues.openai_image_model = values.openaiImageModel;
    if (values.openaiPricing !== undefined) providerValues.openai_pricing = values.openaiPricing;
    const openAIChanged =
      (values.openaiApiKey !== undefined && values.openaiApiKey !== current.data.openai_api_key) ||
      (values.openaiChatModel !== undefined &&
        values.openaiChatModel !== current.data.openai_chat_model) ||
      (values.openaiImageModel !== undefined &&
        values.openaiImageModel !== current.data.openai_image_model) ||
      (values.openaiPricing !== undefined &&
        JSON.stringify(values.openaiPricing) !== JSON.stringify(current.data.openai_pricing));
    if (openAIChanged)
      providerValues.openai_configuration_version = current.data.openai_configuration_version + 1;
    const phoneChanged =
      values.phoneNumberId !== undefined &&
      (values.phoneNumberId || null) !== current.data.phone_number_id;
    const wabaChanged =
      values.wabaId !== undefined && (values.wabaId || null) !== current.data.waba_id;
    const metaChanged =
      normalizedMeta !== null &&
      (normalizedMeta.accessToken !== current.data.access_token ||
        normalizedMeta.appSecret !== current.data.app_secret ||
        normalizedMeta.webhookVerifyToken !== current.data.webhook_verify_token);
    const configurationChanged = phoneChanged || wabaChanged || metaChanged;
    if (configurationChanged)
      providerValues.configuration_version = current.data.configuration_version + 1;
    if (phoneChanged) {
      providerValues.display_phone_number = null;
      providerValues.e164_digits = null;
    }
    if (Object.keys(providerValues).length) {
      const result = await supabase
        .from("organization_provider_settings")
        .update(providerValues)
        .eq("organization_id", organizationId);
      if (result.error) throw result.error;
    }
    return GET(request, { params: Promise.resolve({ organizationId }) });
  } catch (error) {
    return apiException(error);
  }
}
