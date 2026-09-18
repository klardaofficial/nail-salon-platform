// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next/dynamic", () => ({ default: () => () => <div>Chart</div> }));

import { AdminProviders } from "./admin-providers";
import { InboxClient } from "./inbox-client";
import { PlatformActivityClient } from "./platform-activity-client";
import type { InboxMessages, InboxThread } from "@/features/inbox/contracts";
import type { PlatformActivity } from "@/features/analytics/platform-types";

const owner: InboxThread = {
  waId: "49150000001",
  name: "Test Owner",
  roles: ["owner", "technician"],
  lastMessageAt: "2026-09-16T10:00:00Z",
  lastMessage: "Latest synthetic reply",
  direction: "outbound",
};
const organizationId = "00000000-0000-4000-8000-000000000101";
const organizationApi = `/api/admin/organizations/${organizationId}`;
const cursor = JSON.stringify({
  at: "2026-09-16T10:00:00Z",
  id: "inbound:00000000-0000-4000-8000-000000000001",
});
const history: InboxMessages = {
  nextCursor: cursor,
  messages: [
    {
      id: "in",
      direction: "inbound",
      createdAt: "2026-09-16T10:00:00Z",
      state: "processed",
      text: "Synthetic pricing question",
      mediaId: "synthetic-media-id",
    },
    {
      id: "out",
      direction: "outbound",
      createdAt: "2026-09-16T10:01:00Z",
      state: "sent",
      text: "Choose a salon",
      payload: {
        kind: "buttons",
        body: "Choose a salon",
        options: [{ id: "salon:test", title: "Test salon" }],
      },
    },
  ],
};
const activity: PlatformActivity = {
  period: { from: "2026-09-01", to: "2026-09-30", timezone: "Europe/Berlin", channel: "whatsapp" },
  received: 12,
  sent: 20,
  activeUsers: 3,
  ai: [],
  trends: [],
};
let failInbox = false;
type DataFetcher = (url: string) => Promise<unknown>;
let fetcher: ReturnType<typeof vi.fn<DataFetcher>>;

beforeEach(() => {
  failInbox = false;
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
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => computedStyle(element));
  fetcher = vi.fn<DataFetcher>(async (url: string) => {
    const query = new URL(url, "http://test");
    if (query.pathname === `${organizationApi}/inbox`) {
      if (failInbox) throw new Error("Synthetic inbox error");
      return { conversations: [owner], total: 1, pageSize: 30 };
    }
    if (query.pathname === `${organizationApi}/inbox/messages`)
      return query.searchParams.has("cursor")
        ? {
            messages: [
              {
                id: "older",
                direction: "inbound",
                createdAt: "2026-09-15T09:00:00Z",
                state: "processed",
                text: "Older synthetic message",
              },
            ],
            nextCursor: null,
          }
        : history;
    if (query.pathname === `${organizationApi}/platform`)
      return {
        ...activity,
        period: {
          ...activity.period,
          from: query.searchParams.get("from"),
          to: query.searchParams.get("to"),
        },
      };
    if (query.pathname === `${organizationApi}/ai-usage`)
      return { items: [], total: 0, pageSize: 25 };
    throw new Error("Unexpected test endpoint");
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AdminProviders>
      <SWRConfig
        value={{
          provider: () => new Map(),
          fetcher,
          dedupingInterval: 0,
          shouldRetryOnError: false,
        }}
      >
        {children}
      </SWRConfig>
    </AdminProviders>
  );
}

describe("read-only inbox", () => {
  it("shows staff roles, original messages, static choices and media placeholders without reply controls", async () => {
    const { container } = render(<InboxClient />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Test Owner/ }));
    const log = await screen.findByRole("log", { name: "Messages for Test Owner" });
    await within(log).findByText("Synthetic pricing question");
    expect(within(log).getByText("Test salon").closest("button")).toBeNull();
    expect(log.textContent).toContain("synthetic-media-id");
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Read only")).toBeTruthy();
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Technician").length).toBeGreaterThan(0);
  });
  it("loads older history, keeps chronological order and separates the simulator source", async () => {
    render(<InboxClient />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Test Owner/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Load older messages" }));
    const older = await screen.findByText("Older synthetic message");
    const log = older.closest('[role="log"]')!;
    expect(log.textContent!.indexOf("Older synthetic message")).toBeLessThan(
      log.textContent!.indexOf("Synthetic pricing question"),
    );
    expect(
      fetcher.mock.calls.some(
        ([url]) => new URL(url, "http://test").searchParams.get("cursor") === cursor,
      ),
    ).toBe(true);
    fireEvent.click(screen.getByText("Simulator"));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([url]) => url.includes("channel=whatsapp_simulator"))).toBe(
        true,
      ),
    );
    expect(screen.queryByRole("log")).toBeNull();
  });
  it("shows a retryable error without stale private conversation content", async () => {
    failInbox = true;
    render(<InboxClient />, { wrapper: Wrapper });
    expect(await screen.findByText("Could not load conversations")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("log")).toBeNull();
  });
});

describe("platform reporting controls", () => {
  it("shares dates and source between metrics, usage logs and the CSV link", async () => {
    const view = render(<PlatformActivityClient from="2026-09-01" to="2026-09-30" />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText("Messages received")).toBeTruthy();
    expect(screen.getAllByText("Active users").length).toBeGreaterThan(0);
    const download = screen.getByRole("link", { name: "Export activity CSV" });
    expect(download.getAttribute("href")).toBe(
      `${organizationApi}/reports/platform.csv?from=2026-09-01&to=2026-09-30&channel=whatsapp`,
    );
    view.rerender(<PlatformActivityClient from="2026-08-01" to="2026-08-31" />);
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.startsWith(`${organizationApi}/ai-usage?from=2026-08-01&to=2026-08-31`),
        ),
      ).toBe(true),
    );
    expect(
      fetcher.mock.calls.some(([url]) =>
        url.startsWith(`${organizationApi}/platform?from=2026-08-01&to=2026-08-31`),
      ),
    ).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Activity source" }));
    fireEvent.click(await screen.findByText("All sources"));
    await waitFor(() => expect(download.getAttribute("href")).toContain("channel=all"));
    expect(
      fetcher.mock.calls.some(
        ([url]) => url.includes(`${organizationApi}/ai-usage?`) && url.includes("channel=all"),
      ),
    ).toBe(true);
  });
});
