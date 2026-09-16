import { z } from "zod";
import type { ChatMessage } from "@/features/messaging/chat";

export const inboxChannelSchema = z.enum(["whatsapp", "whatsapp_simulator"]).default("whatsapp");
export type InboxChannel = z.infer<typeof inboxChannelSchema>;
export type InboxRole = "all" | "customer" | "owner" | "technician";
export const threadsQuerySchema = z.object({
  channel: inboxChannelSchema,
  search: z.string().trim().max(120).default(""),
  role: z.enum(["all", "customer", "owner", "technician"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
const cursorSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  id: z
    .string()
    .regex(/^(inbound|outbound):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
});
export const messagesQuerySchema = z.object({
  channel: inboxChannelSchema,
  waId: z.string().regex(/^\d{5,32}$/),
  cursor: z
    .string()
    .transform((value): unknown => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })
    .pipe(cursorSchema)
    .optional(),
});
export type InboxThread = {
  waId: string;
  name: string;
  roles: ("owner" | "technician")[];
  lastMessageAt: string;
  lastMessage: string;
  direction: "inbound" | "outbound";
};
export type InboxThreads = { conversations: InboxThread[]; total: number; pageSize: number };
export type InboxMessages = { messages: ChatMessage[]; nextCursor: string | null };
