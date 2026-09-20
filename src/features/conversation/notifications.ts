import "server-only";

import { normalizeLanguageCode } from "@/lib/bot/language";
import { formatStaticDetails, resolveStaticMessages } from "@/lib/bot/static-messages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";
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
      .select("reply_locale,contact:contacts!conversations_organization_contact_fkey!inner(wa_id)")
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

// [salon, customer, phone, appointment, reference] -- the fixed positional
// shape every technician-notification call site in tools.ts and
// scripted-flow.ts builds. The static catalog's technicianConfirmed/
// technicianCancelled templates only reference {details}; the booking
// reference is deliberately omitted here (staff act on the WhatsApp thread
// itself, not a printed ID) to match the copy already authored in
// static-messages.ts.
function staticTechnicianNotificationText(
  locale: string,
  status: "confirmed" | "cancelled",
  parameters: string[],
): string {
  const [salon, customer, phone, appointment] = parameters.map((value) => value || "[N/A]");
  const messages = resolveStaticMessages(locale);
  const template = status === "confirmed" ? messages.technicianConfirmed : messages.technicianCancelled;
  return template.replace(
    "{details}",
    formatStaticDetails(messages.fields, { appointment, salon, customer, phone }),
  );
}

// Single place that decides Meta template vs. AI-authored text vs. static
// localized text for a technician confirm/cancel notification, so the three
// call sites in tools.ts (createBooking/cancelBooking/updateBooking) and
// scripted-flow.ts (confirmBookingFromIntent/cancelBookingForContact) share
// one behavior and automatically respect organization_settings.ai_bot_enabled.
export async function queueTechnicianBookingNotification(input: {
  organizationId: string;
  status: "confirmed" | "cancelled";
  technicianWaId: string;
  bodyParameters: string[];
  deduplicationKey: string;
  transport?: "whatsapp" | "simulator";
}) {
  const supabase = createSupabaseAdminClient();
  const [settings, provider] = await Promise.all([
    supabase
      .from("organization_settings")
      .select("bot_locale,ai_bot_enabled")
      .eq("organization_id", input.organizationId)
      .single(),
    resolveEffectiveMetaConfiguration(input.organizationId),
  ]);
  if (settings.error) throw settings.error;
  const selectedTemplate =
    input.status === "confirmed" ? provider?.templates.confirmed : provider?.templates.cancelled;
  const payload = selectedTemplate?.name
    ? {
        kind: "template" as const,
        name: selectedTemplate.name,
        languageCode: templateLanguageCode(settings.data.bot_locale),
        bodyParameters: input.bodyParameters,
      }
    : {
        kind: "text" as const,
        text: settings.data.ai_bot_enabled
          ? await technicianNotificationText(
              input.organizationId,
              input.status,
              input.bodyParameters,
              await recipientLocale(input.technicianWaId, input.transport, input.organizationId),
              input.transport,
            )
          : staticTechnicianNotificationText(
              settings.data.bot_locale,
              input.status,
              input.bodyParameters,
            ),
      };
  await queueWhatsAppMessage({
    organizationId: input.organizationId,
    transport: input.transport,
    recipientWaId: input.technicianWaId,
    payload,
    deduplicationKey: input.deduplicationKey,
  });
}
