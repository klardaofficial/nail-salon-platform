import { z } from "zod";

import { apiError, apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aiPricingSchema } from "@/features/ai-usage/pricing";
import {
  buildBookingIntentUrl,
  buildPublicCatalogUrl,
  clickToChatUrl,
  resolveEffectiveMetaConfiguration,
  resolveOpenAIConfiguration,
} from "@/features/organizations/providers";
import {
  readOrganizationProfile,
  updateOrganizationProfile,
} from "@/features/organizations/profile";
import { languageCodeSchema } from "@/lib/bot/language";
import { currencyCodeSchema } from "@/lib/currencies";
import { isValidTimeZone } from "@/lib/timezones";

type Context = { params: Promise<{ organizationId: string }> };
const metaFields = z.object({
  accessToken: z.string().nullable(),
  appSecret: z.string().nullable(),
  webhookVerifyToken: z.string().nullable(),
});
const openaiOverrideSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    apiKey: z.string().trim().nullable(),
    chatModel: z.string().trim().min(1).max(120),
    imageModel: z.string().trim().min(1).max(120),
    pricing: aiPricingSchema,
  }),
]);
const httpUrlPattern = /^https?:\/\/\S+$/i;
const updateSchema = z.object({
  organizationName: z.string().trim().min(1).max(120).optional(),
  ownerWaIds: z.string().max(2000).optional(),
  platformTimezone: z.string().trim().min(1).max(80).refine(isValidTimeZone).optional(),
  botLocale: languageCodeSchema.optional(),
  currency: currencyCodeSchema.optional(),
  simulatorEnabled: z.boolean().optional(),
  aiBotEnabled: z.boolean().optional(),
  externalWebsiteUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value.length === 0 || httpUrlPattern.test(value), {
      message: "Enter a valid http(s) URL, or leave it blank.",
    })
    .nullable()
    .optional(),
  wabaId: z.string().trim().max(128).nullable().optional(),
  phoneNumberId: z.string().trim().max(128).nullable().optional(),
  meta: metaFields.optional(),
  confirmedTemplate: z.string().trim().max(512).nullable().optional(),
  cancelledTemplate: z.string().trim().max(512).nullable().optional(),
  reminderTemplate: z.string().trim().max(512).nullable().optional(),
  // Whole-list replace, matching the "Booking reminders" Card's single Save
  // button: every rule present here survives, every other rule for this
  // organization is deleted.
  reminders: z
    .array(z.object({ offsetMinutes: z.number().int().min(60).max(43200) }))
    .max(10)
    .optional(),
  openai: openaiOverrideSchema.optional(),
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
      { data: reminderRules, error: reminderRulesError },
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
      supabase
        .from("booking_reminder_rules")
        .select("id,offset_minutes")
        .eq("organization_id", organizationId)
        .order("offset_minutes", { ascending: true }),
      resolveEffectiveMetaConfiguration(organizationId),
      resolveOpenAIConfiguration(organizationId),
      readOrganizationProfile(organizationId),
    ]);
    if (settingsError ?? providerError ?? reminderRulesError)
      throw settingsError ?? providerError ?? reminderRulesError;
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
          reminderTemplate: provider.booking_reminder_template,
          openai: {
            overrideConfigured: Boolean(provider.openai_api_key?.trim()),
            chatModel: provider.openai_chat_model,
            imageModel: provider.openai_image_model,
            pricing: provider.openai_pricing,
            effective: {
              source: openAI?.source ?? "none",
              chatModel: openAI?.chatModel ?? null,
              imageModel: openAI?.imageModel ?? null,
            },
          },
          source: effective?.source ?? "none",
          readiness: effective?.readiness ?? "incomplete",
          callbackUrl: effective?.callbackUrl,
          displayPhoneNumber: qrAvailable ? effective?.displayPhoneNumber : null,
          clickToChatUrl: qrAvailable ? clickToChatUrl(effective!.e164Digits!) : null,
          bookingIntentUrl: buildBookingIntentUrl(organizationId),
          catalogUrl: buildPublicCatalogUrl(organizationId),
          templates: effective?.templates,
        },
        // Organization-only: no root default list. Rendered as the
        // "Booking reminders" Card's Form.List, keyed by offset_minutes.
        reminders: (reminderRules ?? []).map((rule) => ({
          id: rule.id,
          offsetMinutes: rule.offset_minutes,
        })),
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
      ...(values.currency !== undefined ? { currency: values.currency } : {}),
      ...(values.simulatorEnabled !== undefined
        ? { simulator_enabled: values.simulatorEnabled }
        : {}),
      ...(values.aiBotEnabled !== undefined ? { ai_bot_enabled: values.aiBotEnabled } : {}),
      ...(values.externalWebsiteUrl !== undefined
        ? { external_website_url: values.externalWebsiteUrl?.trim() || null }
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
      if (metaValues.some(Boolean) && !metaValues.every(Boolean)) {
        return apiError(
          "incomplete_meta_override",
          "Access token, app secret, and webhook verify token must all be filled in, or all left blank to use the root credentials.",
          422,
        );
      }
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
    if (values.reminderTemplate !== undefined)
      providerValues.booking_reminder_template = values.reminderTemplate || null;

    let openAIChanged = false;
    if (values.openai) {
      if (!values.openai.enabled) {
        openAIChanged =
          current.data.openai_api_key !== null ||
          current.data.openai_chat_model !== null ||
          current.data.openai_image_model !== null ||
          Object.keys(current.data.openai_pricing ?? {}).length > 0;
        providerValues.openai_api_key = null;
        providerValues.openai_chat_model = null;
        providerValues.openai_image_model = null;
        providerValues.openai_pricing = {};
      } else {
        const { apiKey, chatModel, imageModel, pricing } = values.openai;
        const resolvedKey = apiKey?.trim() || current.data.openai_api_key;
        if (!resolvedKey) {
          return apiError(
            "incomplete_openai_override",
            "An OpenAI API key is required to enable an organization-specific override.",
            422,
          );
        }
        const missingPricing = [chatModel, imageModel].filter((model) => !pricing[model]);
        if (missingPricing.length) {
          return apiError(
            "incomplete_openai_override",
            `Add a pricing row for: ${missingPricing.join(", ")}`,
            422,
          );
        }
        openAIChanged =
          resolvedKey !== current.data.openai_api_key ||
          chatModel !== current.data.openai_chat_model ||
          imageModel !== current.data.openai_image_model ||
          JSON.stringify(pricing) !== JSON.stringify(current.data.openai_pricing);
        providerValues.openai_api_key = resolvedKey;
        providerValues.openai_chat_model = chatModel;
        providerValues.openai_image_model = imageModel;
        providerValues.openai_pricing = pricing;
      }
    }
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

    if (values.reminders !== undefined) {
      const desiredOffsets = Array.from(new Set(values.reminders.map((rule) => rule.offsetMinutes)));
      const existingRules = await supabase
        .from("booking_reminder_rules")
        .select("id,offset_minutes")
        .eq("organization_id", organizationId);
      if (existingRules.error) throw existingRules.error;
      const staleIds = (existingRules.data ?? [])
        .filter((rule) => !desiredOffsets.includes(rule.offset_minutes))
        .map((rule) => rule.id);
      if (staleIds.length) {
        const deleted = await supabase.from("booking_reminder_rules").delete().in("id", staleIds);
        if (deleted.error) throw deleted.error;
      }
      if (desiredOffsets.length) {
        const upserted = await supabase.from("booking_reminder_rules").upsert(
          desiredOffsets.map((offsetMinutes) => ({
            organization_id: organizationId,
            offset_minutes: offsetMinutes,
          })),
          { onConflict: "organization_id,offset_minutes" },
        );
        if (upserted.error) throw upserted.error;
      }
    }

    return GET(request, { params: Promise.resolve({ organizationId }) });
  } catch (error) {
    return apiException(error);
  }
}
