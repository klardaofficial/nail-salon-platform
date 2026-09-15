import "server-only";

import { randomBytes } from "node:crypto";

import { receiveWhatsAppWebhook } from "@/features/messaging/receive-webhook";
import type {
  NormalizedWhatsAppEvent,
  OutboundWhatsAppPayload,
} from "@/integrations/whatsapp/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { simulatorSendSchema, simulatorWaIdSchema, type SimulatorChatMessage } from "./contracts";
import {
  groupSimulatorIdentities,
  resolveSimulatorIdentity,
  type OwnerMapping,
  type TechnicianMapping,
} from "./identities";
import { createSimulatorWebhook } from "./webhook";

export async function listSimulatorIdentities() {
  const supabase = createSupabaseAdminClient();
  const [owners, technicians] = await Promise.all([
    supabase
      .from("business_owners")
      .select("contact:contacts!inner(wa_id,display_name),business:businesses!inner(name)"),
    supabase
      .from("technicians")
      .select("wa_id,display_name,salon:salons!inner(name)")
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (owners.error) throw owners.error;
  if (technicians.error) throw technicians.error;
  return groupSimulatorIdentities(
    owners.data as unknown as OwnerMapping[],
    technicians.data as unknown as TechnicianMapping[],
  );
}

export async function sendSimulatorMessage(input: unknown) {
  const values = simulatorSendSchema.parse(input);
  const identity = resolveSimulatorIdentity(values.identity, await listSimulatorIdentities());
  // This secret exists only for this authenticated, internal invocation. The public
  // Meta endpoint still requires its own app secret and never accepts this key.
  const secret = randomBytes(32).toString("hex");
  const webhook = createSimulatorWebhook(values, identity, secret);
  const response = await receiveWhatsAppWebhook(webhook.rawBody, webhook.signature, secret, true);
  if (!response.ok) throw new Error("The simulated webhook could not be accepted.");
  return { providerEventId: webhook.providerEventId };
}

function outboundText(payload: OutboundWhatsAppPayload) {
  if (payload.kind === "text") return payload.text;
  if (payload.kind === "image")
    return payload.caption || "Image (media preview unavailable in the simulator)";
  if (payload.kind === "template") return [payload.name, ...payload.bodyParameters].join("\n");
  return payload.body;
}

export async function listSimulatorMessages(inputWaId: unknown) {
  const waId = simulatorWaIdSchema.parse(inputWaId);
  const supabase = createSupabaseAdminClient();
  const limit = 100;
  const [inbox, outbox] = await Promise.all([
    supabase
      .from("whatsapp_inbox_events")
      .select("id,payload,received_at,processed_at")
      .eq("contact_wa_id", waId)
      .eq("event_kind", "message")
      .eq("payload->>simulated", "true")
      .order("received_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
    supabase
      .from("message_outbox")
      .select("id,payload,created_at,state,provider_message_id")
      .eq("recipient_wa_id", waId)
      .eq("payload->>transport", "simulator")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
  ]);
  if (inbox.error) throw inbox.error;
  if (outbox.error) throw outbox.error;
  const jobs = inbox.data.length
    ? await supabase
        .from("job_outbox")
        .select("inbox_event_id,state")
        .in(
          "inbox_event_id",
          inbox.data.map((item) => item.id),
        )
    : { data: [], error: null };
  if (jobs.error) throw jobs.error;
  const states = new Map((jobs.data ?? []).map((job) => [job.inbox_event_id, job.state]));
  const messages: SimulatorChatMessage[] = [];
  for (const item of inbox.data) {
    const event = item.payload as NormalizedWhatsAppEvent;
    if (event.kind !== "message") continue;
    messages.push({
      id: item.id,
      direction: "inbound",
      createdAt: item.received_at,
      state: item.processed_at ? "processed" : (states.get(item.id) ?? "pending"),
      text:
        event.message.text ||
        event.message.interactiveTitle ||
        event.message.interactiveId ||
        event.message.caption ||
        `[${event.message.type}]`,
    });
  }
  for (const item of outbox.data) {
    const payload = item.payload as OutboundWhatsAppPayload;
    messages.push({
      id: item.id,
      direction: "outbound",
      createdAt: item.created_at,
      state:
        item.state === "sent" && item.provider_message_id?.startsWith("wamid.simulator.")
          ? "captured"
          : item.state,
      text: outboundText(payload),
      payload,
    });
  }
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { messages: messages.slice(-limit), limit };
}
