import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readPublicCatalog: vi.fn() }));
vi.mock("@/features/organizations/public-catalog", () => ({
  readPublicCatalog: mocks.readPublicCatalog,
}));

import { GET, OPTIONS } from "./route";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";

function contextFor(organizationId = ORGANIZATION_ID) {
  return { params: Promise.resolve({ organizationId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/public/[organizationId]/catalog", () => {
  it("returns the catalog with cache and CORS headers", async () => {
    const catalog = { organization: { id: ORGANIZATION_ID, name: "Glow Nails" } };
    mocks.readPublicCatalog.mockResolvedValue(catalog);

    const response = await GET(new Request("https://example.com"), contextFor());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: catalog });
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mocks.readPublicCatalog).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it("returns organization_not_available with no-store for an unknown organization", async () => {
    mocks.readPublicCatalog.mockResolvedValue(null);

    const response = await GET(new Request("https://example.com"), contextFor());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("organization_not_available");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns the same organization_not_available for a malformed organization ID, without querying", async () => {
    const response = await GET(new Request("https://example.com"), contextFor("not-a-uuid"));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("organization_not_available");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.readPublicCatalog).not.toHaveBeenCalled();
  });

  it("returns a 500 server error when readPublicCatalog throws", async () => {
    mocks.readPublicCatalog.mockRejectedValue(new Error("database unreachable"));

    const response = await GET(new Request("https://example.com"), contextFor());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("server_error");
  });
});

describe("OPTIONS /api/public/[organizationId]/catalog", () => {
  it("returns 204 with CORS preflight headers", async () => {
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });
});
