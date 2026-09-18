import { normalizeWhatsAppWebhook } from "@/integrations/whatsapp/normalize";
import { registerOrganizationEvents } from "@/features/messaging/receive-webhook";
import {
  resolveOrganizationByPhoneNumberId,
  resolveRootMetaCredentials,
} from "@/features/organizations/providers";
import { verifyWebhookChallenge } from "@/integrations/whatsapp/security";
import { verifyWhatsAppSignature } from "@/integrations/whatsapp/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = await resolveRootMetaCredentials();
  if (
    !verifyWebhookChallenge(
      url.searchParams.get("hub.mode"),
      url.searchParams.get("hub.verify_token"),
      config?.verifyToken ?? "",
    )
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const root = await resolveRootMetaCredentials();
  if (
    !root ||
    !verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), root.appSecret)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const events = normalizeWhatsAppWebhook(JSON.parse(rawBody));
    if (
      !events.length ||
      events.some((event) => !event.routing?.wabaId || !event.routing.phoneNumberId)
    ) {
      return new Response("Invalid webhook", { status: 400 });
    }
    const groups = new Map<string, typeof events>();
    for (const event of events) {
      const configuration = await resolveOrganizationByPhoneNumberId(event.routing!.phoneNumberId!);
      if (
        !configuration ||
        configuration.wabaId !== event.routing!.wabaId ||
        !configuration.credentials
      )
        continue;
      if (event.kind === "message" && configuration.readiness !== "enabled") continue;
      if (
        !verifyWhatsAppSignature(
          rawBody,
          request.headers.get("x-hub-signature-256"),
          configuration.credentials.appSecret,
        )
      )
        continue;
      const group = groups.get(configuration.organizationId) ?? [];
      group.push(event);
      groups.set(configuration.organizationId, group);
    }
    for (const group of groups.values()) {
      const configuration = await resolveOrganizationByPhoneNumberId(
        group[0].routing!.phoneNumberId!,
      );
      if (configuration) await registerOrganizationEvents(configuration, group);
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
