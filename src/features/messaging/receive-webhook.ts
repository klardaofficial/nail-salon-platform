import "server-only";

import { inngest } from "@/inngest/client";
import { apiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import { verifyWhatsAppSignature } from "@/integrations/whatsapp/security";
import type { EffectiveMetaConfiguration } from "@/features/organizations/providers";
import type { NormalizedWhatsAppEvent } from "@/integrations/whatsapp/types";

export async function registerOrganizationEvents(
  configuration: EffectiveMetaConfiguration,
  events: NormalizedWhatsAppEvent[],
  simulated = false,
) {
  const supabase = createSupabaseAdminClient();
  for (const event of events) {
    const { data, error } = await supabase.rpc("register_whatsapp_event", {
      p_organization_id: configuration.organizationId,
      p_provider_event_id: event.providerEventId,
      p_event_kind: event.kind,
      p_contact_wa_id: event.contactWaId,
      p_payload: simulated ? { ...event, simulated: true } : event,
    });
    if (error) throw error;
    const registered = Array.isArray(data) ? data[0] : data;
    if (registered?.accepted) {
      console.log("[whatsapp] event accepted, sending whatsapp/event.received", {
        organizationId: configuration.organizationId,
        inboxEventId: registered.inbox_event_id,
        jobOutboxId: registered.job_outbox_id,
        simulated,
      });
      try {
        await inngest.send({
          name: "whatsapp/event.received",
          data: {
            organizationId: configuration.organizationId,
            inboxEventId: registered.inbox_event_id,
            jobOutboxId: registered.job_outbox_id,
            contactWaId: event.contactWaId ?? "status",
          },
        });
        await supabase
          .from("job_outbox")
          .update({ state: "dispatched" })
          .eq("id", registered.job_outbox_id)
          .eq("organization_id", configuration.organizationId);
        console.log("[whatsapp] job_outbox marked dispatched", {
          jobOutboxId: registered.job_outbox_id,
        });
      } catch (sendError) {
        // Recovery reads the organization-scoped durable job row.
        console.error("[whatsapp] inngest.send failed, relying on recoverDurableOutboxes cron", {
          jobOutboxId: registered.job_outbox_id,
          error: sendError,
        });
      }
    } else {
      console.log("[whatsapp] event not accepted by register_whatsapp_event", {
        organizationId: configuration.organizationId,
        providerEventId: event.providerEventId,
        registered,
      });
    }
  }
}

export async function receiveOrganizationWhatsAppWebhook(
  rawBody: string,
  signature: string | null,
  configuration: EffectiveMetaConfiguration,
  options: { verifySignature?: boolean; simulated?: boolean } = {},
) {
  if (!configuration.credentials) {
    return apiError("invalid_configuration", "WhatsApp configuration is not ready", 403);
  }
  if (
    options.verifySignature !== false &&
    !verifyWhatsAppSignature(rawBody, signature, configuration.credentials.appSecret)
  ) {
    return apiError("invalid_signature", "Webhook signature is invalid", 401);
  }
  let events: NormalizedWhatsAppEvent[];
  try {
    events = normalizeWhatsAppWebhook(JSON.parse(rawBody));
  } catch {
    return apiError("invalid_webhook", "Webhook payload is invalid", 400);
  }
  if (
    !events.length ||
    events.some((event) => !event.routing?.wabaId || !event.routing.phoneNumberId)
  ) {
    return apiError("invalid_webhook", "Webhook routing metadata is missing", 400);
  }
  if (
    events.some(
      (event) =>
        event.routing?.wabaId !== configuration.wabaId ||
        event.routing?.phoneNumberId !== configuration.phoneNumberId,
    )
  ) {
    return apiError("invalid_webhook_routing", "Webhook organization mapping does not match", 403);
  }
  const hasMessages = events.some((event) => event.kind === "message");
  if (hasMessages && configuration.readiness !== "enabled") {
    return apiError("organization_disabled", "Organization is not enabled for WhatsApp", 403);
  }
  if (configuration.organizationStatus === "archived" && hasMessages) {
    return apiError("organization_archived", "Organization is archived", 403);
  }
  await registerOrganizationEvents(configuration, events, options.simulated);
  return new Response("EVENT_RECEIVED", { status: 200 });
}
