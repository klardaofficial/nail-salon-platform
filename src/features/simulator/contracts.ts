import { z } from "zod";

import type { OutboundWhatsAppPayload } from "@/integrations/whatsapp/types";

export const simulatorWaIdSchema = z
  .string()
  .trim()
  .regex(/^\d{5,32}$/, "Use 5–32 digits, including the country code, without + or spaces.");
export const simulatorCustomerSchema = z.strictObject({
  waId: simulatorWaIdSchema,
  name: z.string().trim().min(1).max(120),
});
export const simulatorMessageSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), text: z.string().trim().min(1).max(4096) }),
  z.strictObject({
    kind: z.literal("interactive"),
    replyType: z.enum(["button_reply", "list_reply"]),
    id: z.string().min(1).max(256),
    title: z.string().min(1).max(24),
  }),
]);
export const simulatorSendSchema = z.strictObject({
  requestId: z.uuid(),
  identity: z.discriminatedUnion("kind", [
    simulatorCustomerSchema.extend({ kind: z.literal("customer") }),
    z.strictObject({ kind: z.literal("staff"), waId: simulatorWaIdSchema }),
  ]),
  message: simulatorMessageSchema,
});

export type SimulatorCustomer = z.infer<typeof simulatorCustomerSchema>;
export type SimulatorSendInput = z.infer<typeof simulatorSendSchema>;
export type SimulatorIdentity = SimulatorCustomer & {
  roles: ("owner" | "technician")[];
  businesses: string[];
  salons: string[];
};
export type SimulatorActorsResponse = { actors: SimulatorIdentity[]; aiConfigured: boolean };
export type SimulatorChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  state: string;
  text: string;
  payload?: OutboundWhatsAppPayload;
};
export type SimulatorMessagesResponse = { messages: SimulatorChatMessage[]; limit: number };
