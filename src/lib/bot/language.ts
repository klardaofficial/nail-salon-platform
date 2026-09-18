import { z } from "zod";

export const languageOptions = [
  { value: "ar", label: "Arabic (ar)" },
  { value: "bn", label: "Bengali (bn)" },
  { value: "zh-CN", label: "Chinese, Simplified (zh-CN)" },
  { value: "zh-TW", label: "Chinese, Traditional (zh-TW)" },
  { value: "cs", label: "Czech (cs)" },
  { value: "da", label: "Danish (da)" },
  { value: "nl", label: "Dutch (nl)" },
  { value: "en", label: "English (en)" },
  { value: "fi", label: "Finnish (fi)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "el", label: "Greek (el)" },
  { value: "he", label: "Hebrew (he)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "hu", label: "Hungarian (hu)" },
  { value: "id", label: "Indonesian (id)" },
  { value: "it", label: "Italian (it)" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "ko", label: "Korean (ko)" },
  { value: "ms", label: "Malay (ms)" },
  { value: "no", label: "Norwegian (no)" },
  { value: "fa", label: "Persian (fa)" },
  { value: "pl", label: "Polish (pl)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "ro", label: "Romanian (ro)" },
  { value: "ru", label: "Russian (ru)" },
  { value: "sk", label: "Slovak (sk)" },
  { value: "es", label: "Spanish (es)" },
  { value: "sv", label: "Swedish (sv)" },
  { value: "th", label: "Thai (th)" },
  { value: "tr", label: "Turkish (tr)" },
  { value: "uk", label: "Ukrainian (uk)" },
  { value: "ur", label: "Urdu (ur)" },
  { value: "vi", label: "Vietnamese (vi)" },
] as const;

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
