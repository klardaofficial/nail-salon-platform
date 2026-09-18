import "server-only";

import { normalizeLanguageCode } from "@/lib/bot/language";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createLocalizedText } from "./localize";

export async function recipientLocale(
  waId: string,
  transport = "whatsapp",
  organizationId: string,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const [conversation, settings] = await Promise.all([
    supabase
      .from("conversations")
      .select("reply_locale,contact:contacts!inner(wa_id)")
      .eq("contact.wa_id", waId)
      .eq("organization_id", organizationId)
      .eq("channel", transport === "simulator" ? "whatsapp_simulator" : "whatsapp")
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("bot_locale")
      .eq("organization_id", organizationId)
      .single(),
  ]);
  if (conversation.error ?? settings.error) throw conversation.error ?? settings.error;
  return normalizeLanguageCode(conversation.data?.reply_locale ?? "") ?? settings.data.bot_locale;
}

export async function technicianNotificationText(
  organizationId: string,
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
      organizationId,
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
