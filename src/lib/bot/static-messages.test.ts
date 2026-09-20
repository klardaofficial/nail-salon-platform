import { describe, expect, it } from "vitest";
import { languageOptions } from "./language";
import {
  formatStaticDetails,
  formatStaticMessage,
  resolveStaticMessages,
  staticMessageCatalog,
} from "./static-messages";

const EXPECTED_KEYS = [
  "greeting",
  "bookingConfirmed",
  "bookingCancelled",
  "bookingNotCancellable",
  "bookingUnavailable",
  "cancelAction",
  "technicianConfirmed",
  "technicianCancelled",
  "fields",
].sort();

const EXPECTED_FIELD_KEYS = [
  "appointment",
  "salon",
  "services",
  "technician",
  "customer",
  "phone",
].sort();

describe("staticMessageCatalog", () => {
  it("has a bundle for every language option, and no extras", () => {
    const catalogCodes = Object.keys(staticMessageCatalog).sort();
    const optionCodes = languageOptions.map((option) => option.value).slice().sort();
    expect(catalogCodes).toEqual(optionCodes);
  });

  it.each(Object.entries(staticMessageCatalog))(
    "%s bundle has exactly the expected template and field keys",
    (_code, bundle) => {
      expect(Object.keys(bundle).sort()).toEqual(EXPECTED_KEYS);
      expect(Object.keys(bundle.fields).sort()).toEqual(EXPECTED_FIELD_KEYS);
    },
  );

  it.each(Object.entries(staticMessageCatalog))(
    "%s cancelAction is at most 20 characters (WhatsApp button title cap)",
    (_code, bundle) => {
      expect(bundle.cancelAction.length).toBeLessThanOrEqual(20);
    },
  );
});

describe("resolveStaticMessages", () => {
  it("returns the exact match when the locale is a catalog key", () => {
    expect(resolveStaticMessages("de")).toBe(staticMessageCatalog.de);
  });

  it("falls back to the primary subtag when the exact code is not a catalog key", () => {
    expect(resolveStaticMessages("en-US")).toBe(staticMessageCatalog.en);
  });

  it("falls back to en when neither the exact code nor its subtag exist", () => {
    // zh-Hant-TW's primary subtag is "zh", which is not itself a catalog key --
    // only zh-CN/zh-TW are -- so this must not guess a region and fall to en.
    expect(resolveStaticMessages("zh-Hant-TW")).toBe(staticMessageCatalog.en);
  });

  it("falls back to en for a completely unknown code", () => {
    expect(resolveStaticMessages("xx-YY")).toBe(staticMessageCatalog.en);
  });
});

describe("formatStaticMessage", () => {
  it("interpolates every placeholder present in values", () => {
    expect(formatStaticMessage("Hi {name}, ref {ref}", { name: "Sam", ref: "abc" })).toBe(
      "Hi Sam, ref abc",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(formatStaticMessage("Hi {name}", {})).toBe("Hi {name}");
  });
});

describe("formatStaticDetails", () => {
  const fields = staticMessageCatalog.en.fields;

  it("includes only the optional lines that have a value", () => {
    expect(
      formatStaticDetails(fields, {
        appointment: "2099-09-18 10:00",
        salon: null,
        services: null,
        technician: null,
        customer: "Sam",
        phone: "+49151",
      }),
    ).toBe(["Appointment: 2099-09-18 10:00", "Customer: Sam", "Phone: +49151"].join("\n"));
  });

  it("includes every optional line when all values are set", () => {
    expect(
      formatStaticDetails(fields, {
        appointment: "2099-09-18 10:00",
        salon: "Mitte",
        services: "Manicure",
        technician: "Mai",
        customer: "Sam",
        phone: "+49151",
      }),
    ).toBe(
      [
        "Appointment: 2099-09-18 10:00",
        "Salon: Mitte",
        "Services: Manicure",
        "Technician: Mai",
        "Customer: Sam",
        "Phone: +49151",
      ].join("\n"),
    );
  });
});
