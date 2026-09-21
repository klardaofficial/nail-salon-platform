export type WhatsAppMessageType = "text" | "interactive" | "image" | "unsupported";

export type NormalizedWhatsAppEvent =
  | {
      providerEventId: string;
      kind: "message";
      routing?: { wabaId: string | null; phoneNumberId: string | null };
      simulated?: boolean;
      contactWaId: string;
      profileName: string | null;
      occurredAt: string;
      message: {
        type: WhatsAppMessageType;
        text: string | null;
        interactiveId: string | null;
        interactiveTitle?: string;
        mediaId: string | null;
        mimeType: string | null;
        caption: string | null;
      };
    }
  | {
      providerEventId: string;
      kind: "status";
      routing?: { wabaId: string | null; phoneNumberId: string | null };
      contactWaId: string | null;
      occurredAt: string;
      status: {
        messageId: string;
        value: string;
        failureCode: string | null;
      };
    };

export type WhatsAppInteractiveOption = { id: string; title: string; description?: string };

// Simulator-only descriptors contain domain data, never image bytes.
export type SimulatorImage = { kind: "checkin_qr"; bookingId: string };

export type OutboundWhatsAppPayload =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaId: string; caption?: string }
  | { kind: "image"; mediaId: null; caption?: string; simulatorImage: SimulatorImage }
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
