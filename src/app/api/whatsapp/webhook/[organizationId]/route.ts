import { receiveOrganizationWhatsAppWebhook } from "@/features/messaging/receive-webhook";
import { resolveEffectiveMetaConfiguration } from "@/features/organizations/providers";
import { verifyWebhookChallenge } from "@/integrations/whatsapp/security";

export const runtime = "nodejs";

type Context = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { organizationId } = await params;
  const configuration = await resolveEffectiveMetaConfiguration(organizationId);
  const url = new URL(request.url);
  if (
    !configuration?.credentials ||
    !verifyWebhookChallenge(
      url.searchParams.get("hub.mode"),
      url.searchParams.get("hub.verify_token"),
      configuration.credentials.verifyToken,
    )
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(request: Request, { params }: Context) {
  const { organizationId } = await params;
  const configuration = await resolveEffectiveMetaConfiguration(organizationId);
  if (!configuration) return new Response("Not found", { status: 404 });
  return receiveOrganizationWhatsAppWebhook(
    await request.text(),
    request.headers.get("x-hub-signature-256"),
    configuration,
  );
}
