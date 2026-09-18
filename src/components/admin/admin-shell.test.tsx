// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/api/client", () => ({ apiMutation: vi.fn(), apiGet: vi.fn() }));

import { AdminShell } from "./admin-shell";
import { AdminProviders } from "./admin-providers";

const organizationId = "00000000-0000-4000-8000-000000000101";
const admin = {
  id: "admin",
  email: "admin@example.com",
  displayName: "Admin",
  mustChangePassword: false,
  isSystemAdmin: true,
  organizationIds: [organizationId],
};

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

function renderShell() {
  return render(
    <AdminProviders>
      <AdminShell
        admin={admin}
        organizations={[
          { id: organizationId, name: "Berlin Nails", status: "active", simulatorEnabled: false },
        ]}
      >
        <div>Page content</div>
      </AdminShell>
    </AdminProviders>,
  );
}

describe("admin sidebar", () => {
  it("keeps Overview in the selected organization and hides root-only controls", () => {
    mocks.pathname = `/admin/organizations/${organizationId}/bookings`;
    renderShell();

    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe(
      `/admin/organizations/${organizationId}`,
    );
    expect(screen.queryByText("System accounts")).toBeNull();
    expect(screen.queryByText("Root Meta")).toBeNull();
    expect(screen.queryByRole("link", { name: "Business" })).toBeNull();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      `/admin/organizations/${organizationId}/settings`,
    );
  });

  it("shows root-only controls from the organization directory", () => {
    mocks.pathname = "/admin";
    renderShell();

    expect(screen.getByText("System accounts")).toBeTruthy();
    expect(screen.getByText("Root Meta")).toBeTruthy();
  });
});
