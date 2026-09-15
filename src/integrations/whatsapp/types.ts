export type WhatsAppMessageType = "text" | "interactive" | "image" | "unsupported";

export type NormalizedWhatsAppEvent =
  | {
      providerEventId: string;
      kind: "message";
      contactWaId: string;
      profileName: string | null;
      occurredAt: string;
      message: {
        type: WhatsAppMessageType;
        text: string | null;
        interactiveId: string | null;
        mediaId: string | null;
        mimeType: string | null;
        caption: string | null;
      };
    }
  | {
      providerEventId: string;
      kind: "status";
      contactWaId: string | null;
      occurredAt: string;
      status: {
        messageId: string;
        value: string;
        failureCode: string | null;
      };
    };

export type WhatsAppInteractiveOption = { id: string; title: string; description?: string };

export type OutboundWhatsAppPayload =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaId: string; caption?: string }
  | {
      kind: "template";
      name: string;
      languageCode: string;
      bodyParameters: string[];
    }
  | { kind: "buttons"; body: string; options: WhatsAppInteractiveOption[] }
  | {
      kind: "list";
      body: string;
      buttonLabel: string;
      sectionTitle: string;
      options: WhatsAppInteractiveOption[];
    };
