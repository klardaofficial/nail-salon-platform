import { createHmac } from "node:crypto";

import type { SimulatorCustomer, SimulatorSendInput } from "./contracts";

export function createSimulatorWebhook(
  input: Pick<SimulatorSendInput, "message" | "requestId">,
  identity: SimulatorCustomer,
  secret: string,
) {
  const providerEventId = `wamid.simulator.${identity.waId}.${input.requestId}`;
  const message = input.message;
  const rawBody = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "simulator-account",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: identity.name }, wa_id: identity.waId }],
              messages: [
                {
                  from: identity.waId,
                  id: providerEventId,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  ...(message.kind === "text"
                    ? { type: "text", text: { body: message.text } }
                    : {
                        type: "interactive",
                        interactive: {
                          type: message.replyType,
                          [message.replyType]: { id: message.id, title: message.title },
                        },
                      }),
                },
              ],
            },
          },
        ],
      },
    ],
  });
  return {
    providerEventId,
    rawBody,
    signature: `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
  };
}
