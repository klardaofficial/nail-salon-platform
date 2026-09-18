// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiMutation: mocks.mutation, apiGet: vi.fn() }));

import { AdminProviders } from "./admin-providers";
import { OrganizationSettingsClient } from "./organization-settings-client";

const organizationId = "00000000-0000-4000-8000-000000000101";
const endpoint = `/api/admin/organizations/${organizationId}/settings`;
const settingsResponse = {
  organization: {
    name: "Berlin Nails",
    status: "active",
    ownerWaIds: "491111111",
  },
  settings: {
    platform_timezone: "Europe/Berlin",
    bot_locale: "de",
    simulator_enabled: false,
  },
  provider: {
    wabaId: null,
    phoneNumberId: null,
    savedMetaOverride: {
      accessToken: null,
      appSecret: null,
      webhookVerifyToken: null,
    },
    confirmedTemplate: null,
    cancelledTemplate: null,
    openaiConfigured: false,
    openaiChatModel: "gpt-5.4-mini",
    openaiImageModel: "gpt-image-1.5",
    realWhatsAppEnabled: false,
    source: "none",
    readiness: "incomplete",
    callbackUrl: "https://example.com/api/whatsapp/webhook",
    displayPhoneNumber: null,
    clickToChatUrl: null,
  },
};

beforeEach(() => {
  mocks.mutation.mockReset().mockResolvedValue({});
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("organization settings profile", () => {
  it("loads and saves the organization name and owner WhatsApp IDs", async () => {
    await act(async () => {
      render(
        <AdminProviders>
          <SWRConfig
            value={{
              provider: () => new Map(),
              fetcher: async () => settingsResponse,
            }}
          >
            <OrganizationSettingsClient organizationId={organizationId} />
          </SWRConfig>
        </AdminProviders>,
      );
    });

    const name = await screen.findByLabelText("Organization name");
    const owners = screen.getByLabelText("Owner WhatsApp IDs");
    expect((name as HTMLInputElement).value).toBe("Berlin Nails");
    expect((owners as HTMLTextAreaElement).value).toBe("491111111");
    expect(screen.queryByLabelText("WhatsApp Business Account ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Configure organization WhatsApp settings"));
    fireEvent.click(screen.getByLabelText("Configure organization OpenAI settings"));
    expect(screen.getByLabelText("WhatsApp Business Account ID")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(name, { target: { value: "Bangkok Nails" } });
      fireEvent.change(owners, { target: { value: "662222222\n663333333" } });
      fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    });

    await waitFor(() =>
      expect(mocks.mutation).toHaveBeenCalledWith(endpoint, {
        arg: expect.objectContaining({
          method: "PATCH",
          body: expect.objectContaining({
            organizationName: "Bangkok Nails",
            ownerWaIds: "662222222\n663333333",
          }),
        }),
      }),
    );
  });

  it("shows provider fields automatically when organization values already exist", async () => {
    await act(async () => {
      render(
        <AdminProviders>
          <SWRConfig
            value={{
              provider: () => new Map(),
              fetcher: async () => ({
                ...settingsResponse,
                provider: {
                  ...settingsResponse.provider,
                  wabaId: "123456789",
                  openaiConfigured: true,
                },
              }),
            }}
          >
            <OrganizationSettingsClient organizationId={organizationId} />
          </SWRConfig>
        </AdminProviders>,
      );
    });

    expect(await screen.findByLabelText("WhatsApp Business Account ID")).toHaveValue("123456789");
    expect(screen.getByLabelText(/OpenAI API key/)).toBeInTheDocument();
    expect(screen.getByText("Webhook URL")).toBeInTheDocument();
  });
});
