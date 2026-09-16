import type { OutboundWhatsAppPayload } from "@/integrations/whatsapp/types";

export type ChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  state: string;
  text: string;
  mediaId?: string | null;
  payload?: OutboundWhatsAppPayload;
};
export type ChatReply = {
  kind: "interactive";
  replyType: "button_reply" | "list_reply";
  id: string;
  title: string;
};

export function outboundMessageText(payload: OutboundWhatsAppPayload) {
  if (payload.kind === "text") return payload.text;
  if (payload.kind === "image") return payload.caption || "[Image]";
  if (payload.kind === "template") return [payload.name, ...payload.bodyParameters].join("\n");
  return payload.body;
}
