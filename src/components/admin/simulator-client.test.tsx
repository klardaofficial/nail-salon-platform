// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiMutation: mocks.mutation, apiGet: vi.fn() }));

import { AdminProviders } from "./admin-providers";
import { SimulatorClient } from "./simulator-client";
import type { SimulatorMessagesResponse } from "@/features/simulator/contracts";

let root: Root;
let container: HTMLDivElement;
let messages: SimulatorMessagesResponse;
const actors = [
  {
    waId: "4915000000001",
    name: "Test Owner",
    roles: ["owner"],
    business: "Test business",
    salons: [],
  },
  {
    waId: "4915000000002",
    name: "Test Technician",
    roles: ["technician"],
    business: null,
    salons: ["Test salon"],
  },
];
const storageKey = "nail-salon.simulator.customers";

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem(storageKey, "[]");
  mocks.mutation.mockReset().mockResolvedValue({ providerEventId: "test-event" });
  messages = { messages: [], limit: 100 };
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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.setItem(storageKey, "[]");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(
      <AdminProviders>
        <SWRConfig
          value={{
            provider: () => new Map(),
            fetcher: async (url: string) =>
              url.endsWith("/actors") ? { actors, aiConfigured: true } : messages,
            dedupingInterval: 0,
          }}
        >
          <SimulatorClient />
        </SWRConfig>
      </AdminProviders>,
    ),
  );
}

async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
}
function button(label: string, scope: ParentNode = document) {
  return [...scope.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
}
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function addCustomer(name: string, waId: string) {
  await click(button("Add customer", container));
  const dialog = document.querySelector('[role="dialog"]')!;
  await fill(dialog.querySelector<HTMLInputElement>("#name")!, name);
  await fill(dialog.querySelector<HTMLInputElement>("#waId")!, waId);
  await click(button("Add customer", dialog));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("simulator chat windows", () => {
  it("loads database identities and adds, validates, removes and reopens customer windows", async () => {
    await render();
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.textContent).toContain("Test Owner");
    expect(container.textContent).toContain("Test Technician");
    await click(button("Add customer", container));
    const dialog = document.querySelector('[role="dialog"]')!;
    await click(button("Add customer", dialog));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(dialog.textContent).toContain("Enter a customer name.");
    expect(dialog.textContent).toContain("Enter a WhatsApp ID.");
    await fill(dialog.querySelector<HTMLInputElement>("#name")!, "Test Ada");
    await fill(dialog.querySelector<HTMLInputElement>("#waId")!, "4915112345678");
    await click(button("Add customer", dialog));
    expect(container.querySelector('[aria-label="Chat with Test Ada"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual([
      { name: "Test Ada", waId: "4915112345678" },
    ]);
    await addCustomer("Duplicate", "4915112345678");
    expect(document.body.textContent).toContain("A chat already exists for this WhatsApp ID.");
    await click(button("Cancel", document.querySelector('[role="dialog"]')!));
    await click(container.querySelector('[aria-label="Remove customer Test Ada"]'));
    expect(container.querySelector('[aria-label="Chat with Test Ada"]')).toBeNull();
    expect(mocks.mutation).not.toHaveBeenCalled();
    await addCustomer("Test Ada", "4915112345678");
    expect(container.querySelectorAll("section")).toHaveLength(3);
  }, 15_000);

  it("keeps composers independent and retries a failed send with the same request ID", async () => {
    localStorage.setItem(storageKey, JSON.stringify([{ name: "Test Ada", waId: "4915112345678" }]));
    await render();
    const customer = container.querySelector('[aria-label="Chat with Test Ada"]')!;
    const owner = container.querySelector('[aria-label="Chat with Test Owner"]')!;
    await fill(customer.querySelector("textarea")!, "Customer booking request");
    await fill(owner.querySelector("textarea")!, "Owner summary request");
    mocks.mutation.mockRejectedValueOnce(new Error("Connection interrupted"));
    await click(button("Send", customer));
    expect(customer.textContent).toContain("Connection interrupted");
    expect(customer.querySelector("textarea")!.value).toBe("Customer booking request");
    const first = mocks.mutation.mock.calls[0][1].arg.body;
    await click(button("Send", customer));
    expect(mocks.mutation.mock.calls[1][1].arg.body.requestId).toBe(first.requestId);
    expect(customer.querySelector("textarea")!.value).toBe("");
    expect(owner.querySelector("textarea")!.value).toBe("Owner summary request");
    await click(button("Send", owner));
    expect(mocks.mutation.mock.calls[2][1].arg.body.identity).toEqual({
      kind: "staff",
      waId: actors[0].waId,
    });
  });

  it("renders captured list choices and sends a real-format interactive reply", async () => {
    messages = {
      limit: 100,
      messages: [
        {
          id: "reply",
          direction: "outbound",
          createdAt: "2026-09-15T10:00:00Z",
          state: "captured",
          text: "Choose a salon",
          payload: {
            kind: "list",
            body: "Choose a salon",
            buttonLabel: "Choose",
            sectionTitle: "Salons",
            options: [{ id: "salon:test", title: "Test salon" }],
          },
        },
      ],
    };
    await render();
    const owner = container.querySelector('[aria-label="Chat with Test Owner"]')!;
    expect(owner.textContent).toContain("Simulated delivery");
    await click(button("Test salon", owner));
    expect(mocks.mutation.mock.calls[0][1].arg.body.message).toEqual({
      kind: "interactive",
      replyType: "list_reply",
      id: "salon:test",
      title: "Test salon",
    });
  });
});
