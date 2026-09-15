import { z } from "zod";

import type { NormalizedWhatsAppEvent } from "./types";

const webhookSchema = z.object({
  object: z.string().optional(),
  entry: z
    .array(
      z.object({
        changes: z.array(
          z.object({
            value: z.object({
              contacts: z
                .array(
                  z.object({
                    wa_id: z.string(),
                    profile: z.object({ name: z.string().optional() }).optional(),
                  }),
                )
                .optional(),
              messages: z.array(z.record(z.string(), z.unknown())).optional(),
              statuses: z.array(z.record(z.string(), z.unknown())).optional(),
            }),
          }),
        ),
      }),
    )
    .default([]),
});

function timestamp(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

function objectAt(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeWhatsAppWebhook(input: unknown): NormalizedWhatsAppEvent[] {
  const body = webhookSchema.parse(input);
  const events: NormalizedWhatsAppEvent[] = [];

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      const contact = change.value.contacts?.[0];
      for (const message of change.value.messages ?? []) {
        const id = String(message.id ?? "");
        const from = String(message.from ?? contact?.wa_id ?? "");
        if (!id || !from) continue;
        const type = String(message.type ?? "unsupported");
        const textObject = objectAt(message, "text");
        const imageObject = objectAt(message, "image");
        const interactive = objectAt(message, "interactive");
        const buttonReply = objectAt(interactive, "button_reply");
        const listReply = objectAt(interactive, "list_reply");
        events.push({
          providerEventId: id,
          kind: "message",
          contactWaId: from,
          profileName: contact?.profile?.name ?? null,
          occurredAt: timestamp(message.timestamp),
          message: {
            type:
              type === "text" || type === "interactive" || type === "image" ? type : "unsupported",
            text: typeof textObject.body === "string" ? textObject.body : null,
            interactiveId:
              typeof buttonReply.id === "string"
                ? buttonReply.id
                : typeof listReply.id === "string"
                  ? listReply.id
                  : null,
            mediaId: typeof imageObject.id === "string" ? imageObject.id : null,
            mimeType: typeof imageObject.mime_type === "string" ? imageObject.mime_type : null,
            caption: typeof imageObject.caption === "string" ? imageObject.caption : null,
          },
        });
      }

      for (const status of change.value.statuses ?? []) {
        const id = String(status.id ?? "");
        const value = String(status.status ?? "unknown");
        if (!id) continue;
        const errors = Array.isArray(status.errors) ? status.errors : [];
        const firstError = errors[0] as Record<string, unknown> | undefined;
        events.push({
          providerEventId: `${id}:${value}:${String(status.timestamp ?? "")}`,
          kind: "status",
          contactWaId: typeof status.recipient_id === "string" ? status.recipient_id : null,
          occurredAt: timestamp(status.timestamp),
          status: {
            messageId: id,
            value,
            failureCode: firstError?.code === undefined ? null : String(firstError.code),
          },
        });
      }
    }
  }
  return events;
}
