import "server-only";

import { randomBytes } from "node:crypto";

import { registerOrganizationEvents } from "@/features/messaging/receive-webhook";
import { outboundMessageText } from "@/features/messaging/chat";
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
import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import type { EffectiveMetaConfiguration } from "@/features/organizations/providers";

export async function isOrganizationSimulatorEnabled(organizationId: string) {
  const supabase = createSupabaseAdminClient();
  const [organization, settings] = await Promise.all([
    supabase.from("organizations").select("status").eq("id", organizationId).single(),
    supabase
      .from("organization_settings")
      .select("simulator_enabled")
      .eq("organization_id", organizationId)
      .single(),
  ]);
  if (organization.error ?? settings.error) throw organization.error ?? settings.error;
  return organization.data.status === "active" && settings.data.simulator_enabled;
}

export async function listSimulatorIdentities(organizationId: string) {
  const supabase = createSupabaseAdminClient();
  const [owners, technicians] = await Promise.all([
    supabase
      .from("business_owners")
      .select(
        "contact:contacts!business_owners_organization_contact_fkey!inner(wa_id,display_name),business:businesses!business_owners_organization_business_fkey!inner(name)",
      )
      .eq("organization_id", organizationId),
    supabase
      .from("technicians")
      .select("wa_id,display_name,salon:salons!technicians_organization_salon_fkey!inner(name)")
      .eq("organization_id", organizationId)
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

export async function sendSimulatorMessage(organizationId: string, input: unknown) {
  const values = simulatorSendSchema.parse(input);
  const supabase = createSupabaseAdminClient();
  const [
    { data: organization, error: organizationError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase.from("organizations").select("status").eq("id", organizationId).single(),
    supabase
      .from("organization_settings")
      .select("simulator_enabled")
      .eq("organization_id", organizationId)
      .single(),
  ]);
  if (organizationError ?? settingsError) throw organizationError ?? settingsError;
  if (organization.status !== "active" || !settings.simulator_enabled)
    throw new Error("simulator_disabled");
  const identity = resolveSimulatorIdentity(
    values.identity,
    await listSimulatorIdentities(organizationId),
  );
  // This secret exists only for this authenticated, internal invocation. The public
  // Meta endpoint still requires its own app secret and never accepts this key.
  const secret = randomBytes(32).toString("hex");
  const webhook = createSimulatorWebhook(values, identity, secret);
  const events = normalizeWhatsAppWebhook(JSON.parse(webhook.rawBody));
  const simulatedConfiguration: EffectiveMetaConfiguration = {
    organizationId,
    organizationStatus: "active",
    wabaId: "simulator-account",
    phoneNumberId: "simulator",
    credentials: null,
    source: "none",
    callbackUrl: "",
    configurationVersion: 1,
    readiness: "ready_disabled",
    displayPhoneNumber: null,
    e164Digits: null,
    templates: {
      confirmed: { name: null, source: "none" },
      cancelled: { name: null, source: "none" },
    },
  };
  await registerOrganizationEvents(simulatedConfiguration, events, true);
  return { providerEventId: webhook.providerEventId };
}

export async function listSimulatorMessages(organizationId: string, inputWaId: unknown) {
  const waId = simulatorWaIdSchema.parse(inputWaId);
  const supabase = createSupabaseAdminClient();
  const limit = 100;
  const [inbox, outbox] = await Promise.all([
    supabase
      .from("whatsapp_inbox_events")
      .select("id,payload,received_at,processed_at")
      .eq("organization_id", organizationId)
      .eq("contact_wa_id", waId)
      .eq("event_kind", "message")
      .eq("payload->>simulated", "true")
      .order("received_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
    supabase
      .from("message_outbox")
      .select("id,payload,created_at,state,provider_message_id")
      .eq("organization_id", organizationId)
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
        .eq("organization_id", organizationId)
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
      text: outboundMessageText(payload),
      payload,
    });
  }
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { messages: messages.slice(-limit), limit };
}
