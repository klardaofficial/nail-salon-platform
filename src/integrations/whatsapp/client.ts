import "server-only";

import { requireWhatsAppConfig } from "@/lib/config/env";

import type { OutboundWhatsAppPayload } from "./types";

type GraphResult = { id?: string; messages?: { id: string }[]; url?: string; mime_type?: string };

async function graphFetch(path: string, init?: RequestInit) {
  const config = requireWhatsAppConfig();
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
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

export async function sendWhatsAppMessage(to: string, payload: OutboundWhatsAppPayload) {
  const config = requireWhatsAppConfig();
  let message: Record<string, unknown>;
  if (payload.kind === "text") {
    message = { type: "text", text: { preview_url: false, body: payload.text } };
  } else if (payload.kind === "image") {
    message = {
      type: "image",
      image: { id: payload.mediaId, ...(payload.caption ? { caption: payload.caption } : {}) },
    };
  } else if (payload.kind === "template") {
    message = {
      type: "template",
      template: {
        name: payload.name,
        language: { code: payload.languageCode },
        components: payload.bodyParameters.length
          ? [
              {
                type: "body",
                parameters: payload.bodyParameters.map((text) => ({ type: "text", text })),
              },
            ]
          : [],
      },
    };
  } else if (payload.kind === "buttons") {
    if (payload.options.length < 1 || payload.options.length > 3) {
      throw new Error("whatsapp_buttons_require_1_to_3_options");
    }
    message = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: payload.body },
        action: {
          buttons: payload.options.map((option) => ({
            type: "reply",
            reply: { id: option.id.slice(0, 256), title: option.title.slice(0, 20) },
          })),
        },
      },
    };
  } else {
    if (payload.options.length < 1 || payload.options.length > 10) {
      throw new Error("whatsapp_lists_require_1_to_10_options");
    }
    message = {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: payload.body },
        action: {
          button: payload.buttonLabel.slice(0, 20),
          sections: [
            {
              title: payload.sectionTitle.slice(0, 24),
              rows: payload.options.map((option) => ({
                id: option.id.slice(0, 200),
                title: option.title.slice(0, 24),
                ...(option.description ? { description: option.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    };
  }

  const result = await graphFetch(`${config.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...message,
    }),
  });
  const messageId = result.messages?.[0]?.id;
  if (!messageId) throw new Error("whatsapp_message_id_missing");
  return messageId;
}

export async function downloadWhatsAppMedia(mediaId: string) {
  const config = requireWhatsAppConfig();
  const metadata = await graphFetch(mediaId);
  if (!metadata.url) throw new Error("whatsapp_media_url_missing");
  const response = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) throw new Error(`whatsapp_media_download_failed:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    mimeType: metadata.mime_type ?? response.headers.get("content-type") ?? "image/jpeg",
  };
}

export async function uploadWhatsAppMedia(bytes: Uint8Array, mimeType: string) {
  const config = requireWhatsAppConfig();
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", mimeType);
  const fileBytes = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  form.set("file", new Blob([fileBytes], { type: mimeType }), "preview.jpg");
  const result = await graphFetch(`${config.phoneNumberId}/media`, { method: "POST", body: form });
  if (!result.id) throw new Error("whatsapp_media_upload_id_missing");
  return result.id;
}
