import "server-only";

import { inngest } from "@/inngest/client";
import { apiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import { verifyWhatsAppSignature } from "@/integrations/whatsapp/security";

export async function receiveWhatsAppWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
  simulated = false,
) {
  if (!verifyWhatsAppSignature(rawBody, signature, secret)) {
    return apiError("invalid_signature", "Webhook signature is invalid", 401);
  }
  let events;
  try {
    events = normalizeWhatsAppWebhook(JSON.parse(rawBody));
  } catch {
    return apiError("invalid_webhook", "Webhook payload is invalid", 400);
  }

  const supabase = createSupabaseAdminClient();
  for (const event of events) {
    const { data, error } = await supabase.rpc("register_whatsapp_event", {
      p_provider_event_id: event.providerEventId,
      p_event_kind: event.kind,
      p_contact_wa_id: event.contactWaId,
      p_payload: simulated ? { ...event, simulated: true } : event,
    });
    if (error) throw error;
    const registered = Array.isArray(data) ? data[0] : data;
    if (registered?.accepted) {
      try {
        await inngest.send({
          name: "whatsapp/event.received",
          data: {
            inboxEventId: registered.inbox_event_id,
            jobOutboxId: registered.job_outbox_id,
            contactWaId: event.contactWaId ?? "status",
          },
        });
        await supabase
          .from("job_outbox")
          .update({ state: "dispatched" })
          .eq("id", registered.job_outbox_id);
      } catch {
        // The durable job outbox remains pending for the scheduled recovery dispatcher.
      }
    }
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
