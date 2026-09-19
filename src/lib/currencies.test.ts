import { describe, expect, it } from "vitest";
import { currencyCodeSchema, resolveCurrency } from "./currencies";

describe("resolveCurrency", () => {
  it("returns code, name, and symbol for a listed currency", () => {
    expect(resolveCurrency("USD")).toEqual({ code: "USD", name: "US Dollar", symbol: "$" });
  });

  it("falls back to EUR for a currency outside the curated list", () => {
    // organization_settings.currency only enforces 3 uppercase letters at the
    // DB level, so a value like this can reach here despite not being in the
    // curated, symbol-carrying list.
    expect(resolveCurrency("XYZ")).toEqual({ code: "EUR", name: "Euro", symbol: "€" });
  });
});

describe("currencyCodeSchema", () => {
  it("accepts a listed currency code", () => {
    expect(currencyCodeSchema.parse("GBP")).toBe("GBP");
  });

  it("rejects a code outside the curated list", () => {
    expect(() => currencyCodeSchema.parse("XYZ")).toThrow();
  });
});
