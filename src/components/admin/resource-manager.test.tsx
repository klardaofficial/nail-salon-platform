// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiMutation: mocks.mutation, apiGet: vi.fn() }));

import { apiKeys } from "@/lib/api/keys";
import { AdminProviders } from "./admin-providers";
import { ResourceManager } from "./resource-manager";

const business = { id: "11111111-1111-4111-8111-111111111111", name: "Test business" };
const salon = {
  id: "22222222-2222-4222-8222-222222222222",
  business_id: business.id,
  business_name: business.name,
  name: "Test salon",
  location_label: "Berlin",
  timezone: "Europe/Berlin",
  open_time: "08:35",
  close_time: "19:45",
  customer_can_choose_technician: true,
  active: true,
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
  const originalComputedStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    originalComputedStyle(element),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderManager() {
  await act(async () => {
    render(
      <AdminProviders>
        <SWRConfig
          value={{
            provider: () => new Map(),
            fetcher: async (url: string) => ({
              items: url === apiKeys.businesses ? [business] : [salon],
            }),
          }}
        >
          <ResourceManager resource="salons" />
        </SWRConfig>
      </AdminProviders>,
    );
  });
}

async function click(element: HTMLElement) {
  await act(async () => fireEvent.click(element));
}

async function fill(element: HTMLElement, value: string) {
  await act(async () => fireEvent.change(element, { target: { value } }));
}

function expectTimes(opening: string, closing: string) {
  const dialog = within(screen.getByRole("dialog"));
  expect((dialog.getByLabelText("Opening time") as HTMLInputElement).value).toBe(opening);
  expect((dialog.getByLabelText("Closing time") as HTMLInputElement).value).toBe(closing);
}

describe("salon resource form", { timeout: 15_000 }, () => {
  it("opens with default times, searches businesses by label, and creates with HH:mm strings", async () => {
    await renderManager();
    await click(screen.getByRole("button", { name: "Add salon" }));
    expectTimes("09:00", "18:00");

    const dialog = within(screen.getByRole("dialog"));
    await fill(dialog.getByLabelText("Salon name"), "New salon");
    await fill(dialog.getByLabelText("Location"), "Munich");
    const businessSelect = dialog.getByRole("combobox", { name: "Business" });
    await click(businessSelect);
    await fill(businessSelect, "Test business");
    await click(screen.getByText("Test business", { selector: ".ant-select-item-option-content" }));
    await click(dialog.getByRole("button", { name: "OK" }));

    expect(mocks.mutation).toHaveBeenCalledWith(apiKeys.salons, {
      arg: {
        method: "POST",
        body: {
          business_id: business.id,
          name: "New salon",
          location_label: "Munich",
          timezone: "Europe/Berlin",
          open_time: "09:00",
          close_time: "18:00",
          customer_can_choose_technician: false,
          active: true,
        },
      },
    });
  });

  it("displays and saves existing times, then restores defaults when adding another salon", async () => {
    await renderManager();
    await click(screen.getByRole("button", { name: "Edit" }));
    expectTimes("08:35", "19:45");
    await click(within(screen.getByRole("dialog")).getByRole("button", { name: "OK" }));

    expect(mocks.mutation).toHaveBeenCalledWith(apiKeys.salons, {
      arg: {
        method: "PATCH",
        body: {
          id: salon.id,
          business_id: business.id,
          name: salon.name,
          location_label: salon.location_label,
          timezone: salon.timezone,
          open_time: "08:35",
          close_time: "19:45",
          customer_can_choose_technician: true,
          active: true,
        },
      },
    });

    await click(screen.getByRole("button", { name: "Add salon" }));
    expectTimes("09:00", "18:00");
    expect(
      (within(screen.getByRole("dialog")).getByLabelText("Salon name") as HTMLInputElement).value,
    ).toBe("");
  });
});
