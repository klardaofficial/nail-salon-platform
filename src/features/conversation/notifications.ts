import "server-only";

import { getBotLocale } from "@/lib/config/env";
import { normalizeLanguageCode } from "@/lib/bot/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLocalizedText } from "./localize";

export async function recipientLocale(waId: string, transport = "whatsapp"): Promise<string> {
  const { data, error } = await createSupabaseAdminClient()
    .from("conversations")
    .select("reply_locale,contact:contacts!inner(wa_id)")
    .eq("contact.wa_id", waId)
    .eq("channel", transport === "simulator" ? "whatsapp_simulator" : "whatsapp")
    .maybeSingle();
  if (error) throw error;
  return normalizeLanguageCode(data?.reply_locale ?? "") ?? getBotLocale();
}

export async function technicianNotificationText(
  status: "confirmed" | "cancelled",
  parameters: string[],
  locale: string,
  transport?: string,
) {
  const [salon, customer, phone, appointment, reference] = parameters.map(
    (value) => value || "[N/A]",
  );
  return (
    (await createLocalizedText({
      locale,
      transport,
      task: "Notify the technician about a " + status + " booking. Include every supplied detail.",
      details: { salon, customer, phone, appointment, reference },
    })) ?? [status === "confirmed" ? "✅" : "❌", ...parameters].join("\n")
  );
}

export function templateLanguageCode(locale: string) {
  // Meta uses underscores and the approved en_US variant for the legacy en default.
  return locale === "en" ? "en_US" : locale.replaceAll("-", "_");
}
