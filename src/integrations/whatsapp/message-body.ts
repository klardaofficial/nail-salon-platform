import type { OutboundWhatsAppPayload } from "./types";

/** Shared provider formatting and validation for real and simulated delivery. */
export function buildWhatsAppMessageBody(to: string, payload: OutboundWhatsAppPayload) {
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
    if (payload.options.length < 1 || payload.options.length > 3)
      throw new Error("whatsapp_buttons_require_1_to_3_options");
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
    if (payload.options.length < 1 || payload.options.length > 10)
      throw new Error("whatsapp_lists_require_1_to_10_options");
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
  return { messaging_product: "whatsapp", recipient_type: "individual", to, ...message };
}
