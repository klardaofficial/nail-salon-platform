import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeOwnerIds } from "./profile";

describe("organization profile owner IDs", () => {
  it("normalizes comma and newline separated IDs and removes duplicates", () => {
    expect(normalizeOwnerIds("+491111111\n 662222222,491111111\n")).toEqual([
      "491111111",
      "662222222",
    ]);
  });

  it("supports clearing every owner mapping", () => {
    expect(normalizeOwnerIds(" \n, ")).toEqual([]);
  });
});
