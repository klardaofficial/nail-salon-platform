import { z } from "zod";

export function normalizeLanguageCode(value: string) {
  try {
    return Intl.getCanonicalLocales(value.replaceAll("_", "-"))[0] ?? null;
  } catch {
    return null;
  }
}

export const languageCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .refine(
    (value) => normalizeLanguageCode(value) !== null,
    "Use a valid language code, such as de, en-US, vi, or th",
  )
  .transform((value) => normalizeLanguageCode(value)!);

// Used only before a localized fallback has been generated, or during a provider outage.
export const unavailableFallback = "⚠️ ⏳ ↻";
