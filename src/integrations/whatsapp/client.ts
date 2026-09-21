import "server-only";

import type { OutboundWhatsAppPayload } from "./types";
import { buildWhatsAppMessageBody } from "./message-body";
import { WHATSAPP_API_VERSION } from "./version";

export { WHATSAPP_API_VERSION } from "./version";

type GraphResult = { id?: string; messages?: { id: string }[]; url?: string; mime_type?: string };

export type WhatsAppProviderConfig = {
  phoneNumberId: string;
  accessToken: string;
};

async function graphFetch(path: string, provider: WhatsAppProviderConfig, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${provider.accessToken}`,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const result = (await response.json()) as GraphResult & {
    error?: { message?: string; code?: number };
  };
  if (!response.ok || result.error) {
    throw new Error(`whatsapp_graph_error:${result.error?.code ?? response.status}`);
  }
  return result;
}

export async function sendWhatsAppMessage(
  to: string,
  payload: OutboundWhatsAppPayload,
  provider: WhatsAppProviderConfig,
) {
  const result = await graphFetch(`${provider.phoneNumberId}/messages`, provider, {
    method: "POST",
    body: JSON.stringify(buildWhatsAppMessageBody(to, payload)),
  });
  const messageId = result.messages?.[0]?.id;
  if (!messageId) throw new Error("whatsapp_message_id_missing");
  return messageId;
}

export async function downloadWhatsAppMedia(mediaId: string, provider: WhatsAppProviderConfig) {
  const metadata = await graphFetch(mediaId, provider);
  if (!metadata.url) throw new Error("whatsapp_media_url_missing");
  const response = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${provider.accessToken}` },
  });
  if (!response.ok) throw new Error(`whatsapp_media_download_failed:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    mimeType: metadata.mime_type ?? response.headers.get("content-type") ?? "image/jpeg",
  };
}

export async function uploadWhatsAppMedia(
  bytes: Uint8Array,
  mimeType: string,
  provider: WhatsAppProviderConfig,
  filename = "preview.jpg",
) {
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", mimeType);
  const fileBytes = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  form.set("file", new Blob([fileBytes], { type: mimeType }), filename);
  const result = await graphFetch(`${provider.phoneNumberId}/media`, provider, {
    method: "POST",
    body: form,
  });
  if (!result.id) throw new Error("whatsapp_media_upload_id_missing");
  return result.id;
}
