import { de } from "./de";
import { en } from "./en";

import type { BotLocale } from "@/lib/config/env";

export type BotMessages = { [Key in keyof typeof en]: string };

export function getBotMessages(locale: BotLocale): BotMessages {
  return locale === "en" ? en : de;
}
