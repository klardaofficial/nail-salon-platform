import { inngest } from "@/inngest/client";
import { apiError } from "@/lib/api/response";
import { requireWhatsAppConfig } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import { verifyWebhookChallenge, verifyWhatsAppSignature } from "@/integrations/whatsapp/security";

export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const config = requireWhatsAppConfig();
  if (
    !verifyWebhookChallenge(
      url.searchParams.get("hub.mode"),
      url.searchParams.get("hub.verify_token"),
      config.verifyToken,
    )
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const config = requireWhatsAppConfig();
  if (
    !verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)
  ) {
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
      p_payload: event,
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
