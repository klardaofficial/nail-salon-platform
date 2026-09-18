import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  normalize: vi.fn(),
  receive: vi.fn(),
  register: vi.fn(),
  resolveEffective: vi.fn(),
  resolveOrganization: vi.fn(),
  resolveRoot: vi.fn(),
  verifyChallenge: vi.fn(),
  verifySignature: vi.fn(),
}));

vi.mock("@/integrations/whatsapp/normalize", () => ({
  normalizeWhatsAppWebhook: mocks.normalize,
}));
vi.mock("@/features/messaging/receive-webhook", () => ({
  receiveOrganizationWhatsAppWebhook: mocks.receive,
  registerOrganizationEvents: mocks.register,
}));
vi.mock("@/features/organizations/providers", () => ({
  resolveEffectiveMetaConfiguration: mocks.resolveEffective,
  resolveOrganizationByPhoneNumberId: mocks.resolveOrganization,
  resolveRootMetaCredentials: mocks.resolveRoot,
}));
vi.mock("@/integrations/whatsapp/security", () => ({
  verifyWebhookChallenge: mocks.verifyChallenge,
  verifyWhatsAppSignature: mocks.verifySignature,
}));

import { POST as receiveOrganizationCallback } from "@/app/api/whatsapp/webhook/[organizationId]/route";
import { POST as receiveRootCallback } from "@/app/api/whatsapp/webhook/route";

const organizationId = "00000000-0000-4000-8000-000000000101";
const credentials = { accessToken: "token", appSecret: "secret", verifyToken: "verify" };
const event = {
  providerEventId: "wamid.test",
  kind: "message",
  contactWaId: "491111111",
  routing: { wabaId: "waba", phoneNumberId: "phone" },
};
const configuration = {
  organizationId,
  organizationStatus: "active",
  wabaId: "waba",
  phoneNumberId: "phone",
  credentials,
  source: "root",
  callbackUrl: "https://example.com/api/whatsapp/webhook",
  configurationVersion: 1,
  readiness: "enabled",
  displayPhoneNumber: "+49 1111111",
  e164Digits: "491111111",
  templates: {
    confirmed: { name: null, source: "none" },
    cancelled: { name: null, source: "none" },
  },
};

function webhookRequest() {
  return new Request("https://example.com/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=signature" },
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveRoot.mockResolvedValue(credentials);
  mocks.verifySignature.mockReturnValue(true);
  mocks.normalize.mockReturnValue([event]);
  mocks.register.mockResolvedValue(undefined);
  mocks.receive.mockResolvedValue(new Response("EVENT_RECEIVED"));
});

describe("WhatsApp callback credential routing", () => {
  it("registers an organization that inherits the root credentials", async () => {
    mocks.resolveOrganization.mockResolvedValue(configuration);

    const response = await receiveRootCallback(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.register).toHaveBeenCalledWith(configuration, [event]);
  });

  it("leaves an organization override to its organization callback", async () => {
    mocks.resolveOrganization.mockResolvedValue({ ...configuration, source: "organization" });

    const response = await receiveRootCallback(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("returns a retryable error when root event persistence fails", async () => {
    mocks.resolveOrganization.mockResolvedValue(configuration);
    mocks.register.mockRejectedValue(new Error("database unavailable"));

    const response = await receiveRootCallback(webhookRequest());

    expect(response.status).toBe(500);
  });

  it("uses root fallback credentials on the organization callback", async () => {
    mocks.resolveEffective.mockResolvedValue(configuration);

    const response = await receiveOrganizationCallback(webhookRequest(), {
      params: Promise.resolve({ organizationId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.receive).toHaveBeenCalledWith("{}", "sha256=signature", configuration);
  });

  it("uses the organization callback for a complete organization override", async () => {
    const override = { ...configuration, source: "organization" };
    mocks.resolveEffective.mockResolvedValue(override);

    const response = await receiveOrganizationCallback(webhookRequest(), {
      params: Promise.resolve({ organizationId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.receive).toHaveBeenCalledWith("{}", "sha256=signature", override);
  });
});
