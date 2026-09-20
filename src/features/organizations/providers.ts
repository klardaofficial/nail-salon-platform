import "server-only";

import { getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aiPricingSchema, type AIPricing } from "@/features/ai-usage/pricing";
import { WHATSAPP_API_VERSION } from "@/integrations/whatsapp/version";

export type MetaCredentialBundle = {
  accessToken: string;
  appSecret: string;
  verifyToken: string;
};

export type EffectiveMetaConfiguration = {
  organizationId: string;
  organizationStatus: "active" | "archived";
  wabaId: string | null;
  phoneNumberId: string | null;
  credentials: MetaCredentialBundle | null;
  source: "root" | "organization" | "none";
  callbackUrl: string;
  configurationVersion: number;
  readiness: "incomplete" | "unvalidated" | "invalid" | "ready_disabled" | "enabled";
  displayPhoneNumber: string | null;
  e164Digits: string | null;
  templates: {
    confirmed: { name: string | null; source: "root" | "organization" | "none" };
    cancelled: { name: string | null; source: "root" | "organization" | "none" };
  };
};

function present(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

function bundle(row: {
  access_token: string | null;
  app_secret: string | null;
  webhook_verify_token: string | null;
}): MetaCredentialBundle | null {
  if (!present(row.access_token) || !present(row.app_secret) || !present(row.webhook_verify_token))
    return null;
  return {
    accessToken: row.access_token.trim(),
    appSecret: row.app_secret.trim(),
    verifyToken: row.webhook_verify_token.trim(),
  };
}

export function buildWebhookCallbackUrl(organizationId?: string) {
  return new URL(
    organizationId ? `/api/whatsapp/webhook/${organizationId}` : "/api/whatsapp/webhook",
    getServerEnv().APP_URL,
  ).toString();
}

// Base URL for the public, unauthenticated booking-intent hand-off endpoint
// (see docs/architecture/authorization.md "Public booking-intent endpoint").
// An external booking website appends its own salonId/startsAt/serviceIds/
// technicianRef/additionalRequest query parameters to this URL.
export function buildBookingIntentUrl(organizationId: string) {
  return new URL(`/api/public/${organizationId}/booking-intent`, getServerEnv().APP_URL).toString();
}

// Base URL for the public, unauthenticated catalog endpoint (see
// docs/architecture/authorization.md "Public endpoints" and BOOK-08 in
// docs/product/requirements.md). Publishes this organization's salon/
// service/technician UUIDs, timezone, and hours so an external booking
// website can discover the identifiers buildBookingIntentUrl's query
// parameters accept.
export function buildPublicCatalogUrl(organizationId: string) {
  return new URL(`/api/public/${organizationId}/catalog`, getServerEnv().APP_URL).toString();
}

// The organization's own booking site, shown to customers in scripted-mode
// replies (src/lib/bot/static-messages.ts) so they can book again without
// the AI bot. Falls back to the deployment root when the organization has
// not set one.
export function resolveExternalWebsiteUrl(stored: string | null | undefined): string {
  return stored?.trim() || getServerEnv().APP_URL;
}

function template(
  organizationValue: string | null,
  rootValue: string | null,
  source: "root" | "organization" | "none",
) {
  if (present(organizationValue))
    return { name: organizationValue.trim(), source: "organization" as const };
  if (source === "root" && present(rootValue))
    return { name: rootValue.trim(), source: "root" as const };
  return { name: null, source: "none" as const };
}

export async function resolveEffectiveMetaConfiguration(
  organizationId: string,
): Promise<EffectiveMetaConfiguration | null> {
  const supabase = createSupabaseAdminClient();
  const [
    { data: organization, error: organizationError },
    { data: provider, error: providerError },
    { data: root, error: rootError },
    { data: validation, error: validationError },
  ] = await Promise.all([
    supabase.from("organizations").select("id,status").eq("id", organizationId).maybeSingle(),
    supabase
      .from("organization_provider_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("root_settings").select("*").eq("singleton", true).maybeSingle(),
    supabase
      .from("provider_configuration_validations")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (organizationError ?? providerError ?? rootError ?? validationError) {
    throw organizationError ?? providerError ?? rootError ?? validationError;
  }
  if (!organization || !provider) return null;
  const override = bundle(provider);
  const source = override
    ? "organization"
    : bundle(root ?? { access_token: null, app_secret: null, webhook_verify_token: null })
      ? "root"
      : "none";
  const credentials = override ?? (root ? bundle(root) : null);
  const validated = validation?.configuration_version === provider.configuration_version;
  const readiness =
    !present(provider.waba_id) || !present(provider.phone_number_id) || !credentials
      ? "incomplete"
      : !validated
        ? "unvalidated"
        : validation.status === "failed"
          ? "invalid"
          : organization.status !== "active"
            ? "ready_disabled"
            : "enabled";
  return {
    organizationId,
    organizationStatus: organization.status,
    wabaId: provider.waba_id?.trim() || null,
    phoneNumberId: provider.phone_number_id?.trim() || null,
    credentials,
    source,
    callbackUrl: buildWebhookCallbackUrl(organizationId),
    configurationVersion: provider.configuration_version,
    readiness,
    displayPhoneNumber: provider.display_phone_number,
    e164Digits: provider.e164_digits,
    templates: {
      confirmed: template(
        provider.technician_booking_confirmed_template,
        root?.technician_booking_confirmed_template ?? null,
        source,
      ),
      cancelled: template(
        provider.technician_booking_cancelled_template,
        root?.technician_booking_cancelled_template ?? null,
        source,
      ),
    },
  };
}

export async function resolveOrganizationByPhoneNumberId(phoneNumberId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organization_provider_settings")
    .select("organization_id")
    .eq("phone_number_id", phoneNumberId.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? resolveEffectiveMetaConfiguration(data.organization_id) : null;
}

export async function resolveRootMetaCredentials() {
  const { data, error } = await createSupabaseAdminClient()
    .from("root_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw error;
  return data ? bundle(data) : null;
}

export function normalizeE164Digits(displayNumber: string) {
  const digits = displayNumber.replace(/[^0-9]/g, "");
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null;
}

export function clickToChatUrl(e164Digits: string) {
  if (!/^[1-9][0-9]{7,14}$/.test(e164Digits)) throw new Error("invalid_e164_destination");
  return `https://wa.me/${e164Digits}`;
}

// Sibling of clickToChatUrl carrying a prefilled message, for callers that
// need the customer's browser to land on WhatsApp with text already typed
// (the booking-intent callback). Kept separate so clickToChatUrl's existing
// signature and callers (qr/route.ts, settings/route.ts) are untouched.
export function clickToChatUrlWithText(e164Digits: string, text: string) {
  return `${clickToChatUrl(e164Digits)}?text=${encodeURIComponent(text)}`;
}

export async function validateOrganizationProviderConfiguration(organizationId: string) {
  const configuration = await resolveEffectiveMetaConfiguration(organizationId);
  if (!configuration?.credentials || !configuration.wabaId || !configuration.phoneNumberId) {
    throw new Error("provider_configuration_incomplete");
  }
  let status: "succeeded" | "failed" = "failed";
  let failureCode: string | null = "provider_validation_failed";
  let displayPhoneNumber: string | null = null;
  let e164Digits: string | null = null;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${encodeURIComponent(configuration.phoneNumberId)}?fields=id,display_phone_number`,
      { headers: { Authorization: `Bearer ${configuration.credentials.accessToken}` } },
    );
    const result = (await response.json()) as {
      id?: string;
      display_phone_number?: string;
      error?: { code?: number };
    };
    if (!response.ok || result.error) failureCode = `meta_${result.error?.code ?? response.status}`;
    else if (result.id !== configuration.phoneNumberId) failureCode = "provider_mapping_mismatch";
    else {
      const wabaResponse = await fetch(
        `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${encodeURIComponent(configuration.wabaId)}/phone_numbers?fields=id`,
        { headers: { Authorization: `Bearer ${configuration.credentials.accessToken}` } },
      );
      const wabaResult = (await wabaResponse.json()) as {
        data?: Array<{ id?: string }>;
        error?: { code?: number };
      };
      if (!wabaResponse.ok || wabaResult.error)
        failureCode = `meta_${wabaResult.error?.code ?? wabaResponse.status}`;
      else if (!wabaResult.data?.some((phone) => phone.id === configuration.phoneNumberId))
        failureCode = "provider_mapping_mismatch";
      else {
        displayPhoneNumber = result.display_phone_number ?? null;
        e164Digits = displayPhoneNumber ? normalizeE164Digits(displayPhoneNumber) : null;
        if (!e164Digits) failureCode = "invalid_display_phone_number";
        else {
          status = "succeeded";
          failureCode = null;
        }
      }
    }
  } catch {
    failureCode = "provider_unreachable";
  }
  const supabase = createSupabaseAdminClient();
  const validation = await supabase.from("provider_configuration_validations").upsert({
    organization_id: organizationId,
    configuration_version: configuration.configurationVersion,
    status,
    failure_code: failureCode,
    validated_at: new Date().toISOString(),
  });
  if (validation.error) throw validation.error;
  const savedPhone = await supabase
    .from("organization_provider_settings")
    .update({ display_phone_number: displayPhoneNumber, e164_digits: e164Digits })
    .eq("organization_id", organizationId);
  if (savedPhone.error) throw savedPhone.error;
  return { status, failureCode, displayPhoneNumber, e164Digits };
}

export type EffectiveOpenAIConfiguration = {
  organizationId: string;
  apiKey: string;
  chatModel: string;
  imageModel: string;
  pricing: Record<string, AIPricing>;
  source: "root" | "organization";
  configurationVersion: number;
};

export async function resolveOpenAIConfiguration(
  organizationId: string,
): Promise<EffectiveOpenAIConfiguration | null> {
  const supabase = createSupabaseAdminClient();
  const [{ data: organization, error: organizationError }, { data: root, error: rootError }] =
    await Promise.all([
      supabase
        .from("organization_provider_settings")
        .select(
          "organization_id,openai_api_key,openai_chat_model,openai_image_model,openai_pricing,openai_configuration_version",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase.from("root_settings").select("*").eq("singleton", true).maybeSingle(),
    ]);
  if (organizationError ?? rootError) throw organizationError ?? rootError;
  if (!organization) return null;
  if (
    present(organization.openai_api_key) &&
    present(organization.openai_chat_model) &&
    present(organization.openai_image_model)
  ) {
    return {
      organizationId: organization.organization_id,
      apiKey: organization.openai_api_key.trim(),
      chatModel: organization.openai_chat_model,
      imageModel: organization.openai_image_model,
      pricing: aiPricingSchema.catch({}).parse(organization.openai_pricing),
      source: "organization",
      configurationVersion: organization.openai_configuration_version,
    };
  }
  if (root && present(root.openai_api_key)) {
    return {
      organizationId: organization.organization_id,
      apiKey: root.openai_api_key.trim(),
      chatModel: root.openai_chat_model,
      imageModel: root.openai_image_model,
      pricing: aiPricingSchema.catch({}).parse(root.openai_pricing),
      source: "root",
      configurationVersion: root.openai_configuration_version,
    };
  }
  return null;
}
