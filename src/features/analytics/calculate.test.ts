import { describe, expect, it } from "vitest";

import { calculateAnalytics } from "./calculate";

describe("calculateAnalytics", () => {
  it("keeps cancellations in totals and counts returning customers by cohort", () => {
    const result = calculateAnalytics(
      [
        { contactId: "customer-a", createdAt: "2026-09-13T10:00:00Z", status: "confirmed" },
        { contactId: "customer-a", createdAt: "2026-09-14T10:00:00Z", status: "cancelled" },
        { contactId: "customer-b", createdAt: "2026-09-15T10:00:00Z", status: "confirmed" },
      ],
      new Set(["customer-a"]),
      "2026-09-13",
      "2026-09-15",
      "Europe/Berlin",
    );

    expect(result.totals).toEqual({
      total: 3,
      confirmed: 2,
      cancelled: 1,
      uniqueCustomers: 2,
      returningCustomers: 1,
      repeatRate: 50,
    });
    expect(result.trends.map((point) => point.total)).toEqual([1, 1, 1]);
  });

  it("returns a zero repeat rate for an empty cohort", () => {
    const result = calculateAnalytics([], new Set(), "2026-09-15", "2026-09-15", "Europe/Berlin");
    expect(result.totals.repeatRate).toBe(0);
    expect(result.trends).toHaveLength(1);
  });
});
