import { receiveWhatsAppWebhook } from "@/features/messaging/receive-webhook";
import { requireWhatsAppConfig } from "@/lib/config/env";
import { verifyWebhookChallenge } from "@/integrations/whatsapp/security";

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
  return receiveWhatsAppWebhook(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    config.appSecret,
  );
}
