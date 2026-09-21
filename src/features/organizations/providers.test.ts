import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({
  getServerEnv: () => ({ APP_URL: "https://example.com" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { resolveEffectiveMetaConfiguration, validateOrganizationProviderConfiguration } from "./providers";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const WABA_ID = "4228305944129331";
const PHONE_NUMBER_ID = "1401474716375344";

function seedConfiguration() {
  const records: Record<string, unknown> = {
    organizations: { id: ORGANIZATION_ID, status: "active" },
    organization_provider_settings: {
      waba_id: WABA_ID,
      phone_number_id: PHONE_NUMBER_ID,
      access_token: null,
      app_secret: null,
      webhook_verify_token: null,
      configuration_version: 3,
    },
    root_settings: {
      access_token: "token",
      app_secret: "secret",
      webhook_verify_token: "verify",
    },
    provider_configuration_validations: null,
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "provider_configuration_validations")
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: records[table], error: null }) }),
        }),
        upsert: async () => ({ error: null }),
      };
    if (table === "organization_provider_settings")
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: records[table], error: null }) }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: records[table], error: null }) }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedConfiguration();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateOrganizationProviderConfiguration", () => {
  it("validates WABA ownership through its phone_numbers edge", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: PHONE_NUMBER_ID, display_phone_number: "+84 37 213 0747" }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: PHONE_NUMBER_ID }] })));

    await expect(validateOrganizationProviderConfiguration(ORGANIZATION_ID)).resolves.toEqual({
      status: "succeeded",
      failureCode: null,
      displayPhoneNumber: "+84 37 213 0747",
      e164Digits: "84372130747",
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}?fields=id,display_phone_number`,
      `https://graph.facebook.com/v26.0/${WABA_ID}/phone_numbers?fields=id`,
    ]);
  });

  it("rejects a phone that is not owned by the configured WABA", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: PHONE_NUMBER_ID, display_phone_number: "+84 37 213 0747" }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "other-phone" }] })));

    await expect(validateOrganizationProviderConfiguration(ORGANIZATION_ID)).resolves.toMatchObject(
      {
        status: "failed",
        failureCode: "provider_mapping_mismatch",
      },
    );
  });
});

// The reminder template must resolve through exactly the same
// organization-over-root precedence as the technician confirmed/cancelled
// templates (BOOK-11), including root's dependence on inherited root
// credentials — a root template never applies when the organization has its
// own complete Meta credential override, since `source` would then be
// "organization".
function seedTemplates(options: {
  organizationReminderTemplate: string | null;
  rootReminderTemplate: string | null;
  organizationHasOwnCredentials: boolean;
}) {
  const records: Record<string, unknown> = {
    organizations: { id: ORGANIZATION_ID, status: "active" },
    organization_provider_settings: {
      waba_id: WABA_ID,
      phone_number_id: PHONE_NUMBER_ID,
      access_token: options.organizationHasOwnCredentials ? "org-token" : null,
      app_secret: options.organizationHasOwnCredentials ? "org-secret" : null,
      webhook_verify_token: options.organizationHasOwnCredentials ? "org-verify" : null,
      configuration_version: 3,
      technician_booking_confirmed_template: null,
      technician_booking_cancelled_template: null,
      booking_reminder_template: options.organizationReminderTemplate,
    },
    root_settings: {
      access_token: "root-token",
      app_secret: "root-secret",
      webhook_verify_token: "root-verify",
      technician_booking_confirmed_template: null,
      technician_booking_cancelled_template: null,
      booking_reminder_template: options.rootReminderTemplate,
    },
    provider_configuration_validations: null,
  };
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: records[table], error: null }) }),
    }),
  }));
}

describe("resolveEffectiveMetaConfiguration templates.reminder", () => {
  it("prefers the organization's own reminder template over the root default", async () => {
    seedTemplates({
      organizationReminderTemplate: "org_reminder",
      rootReminderTemplate: "root_reminder",
      organizationHasOwnCredentials: true,
    });
    const configuration = await resolveEffectiveMetaConfiguration(ORGANIZATION_ID);
    expect(configuration?.templates.reminder).toEqual({
      name: "org_reminder",
      source: "organization",
    });
  });

  it("falls back to the root reminder template when root credentials are inherited", async () => {
    seedTemplates({
      organizationReminderTemplate: null,
      rootReminderTemplate: "root_reminder",
      organizationHasOwnCredentials: false,
    });
    const configuration = await resolveEffectiveMetaConfiguration(ORGANIZATION_ID);
    expect(configuration?.templates.reminder).toEqual({ name: "root_reminder", source: "root" });
  });

  it("never inherits the root reminder template when the organization has its own credentials", async () => {
    seedTemplates({
      organizationReminderTemplate: null,
      rootReminderTemplate: "root_reminder",
      organizationHasOwnCredentials: true,
    });
    const configuration = await resolveEffectiveMetaConfiguration(ORGANIZATION_ID);
    expect(configuration?.templates.reminder).toEqual({ name: null, source: "none" });
  });

  it("resolves to null when no reminder template is configured at either level", async () => {
    seedTemplates({
      organizationReminderTemplate: null,
      rootReminderTemplate: null,
      organizationHasOwnCredentials: false,
    });
    const configuration = await resolveEffectiveMetaConfiguration(ORGANIZATION_ID);
    expect(configuration?.templates.reminder).toEqual({ name: null, source: "none" });
  });
});
