import { createHmac } from "node:crypto";

const target = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.WHATSAPP_APP_SECRET;
if (!secret) throw new Error("WHATSAPP_APP_SECRET is required");

const waId = process.argv[2] ?? "4915112345678";
const text = process.argv.slice(3).join(" ") || "Hallo, ich möchte morgen um 15 Uhr buchen";
const now = Math.floor(Date.now() / 1000).toString();
const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "synthetic-account",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            contacts: [{ profile: { name: "Synthetic Customer" }, wa_id: waId }],
            messages: [
              {
                from: waId,
                id: `wamid.synthetic.${Date.now()}`,
                timestamp: now,
                text: { body: text },
                type: "text",
              },
            ],
          },
        },
      ],
    },
  ],
});
const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
const response = await fetch(`${target}/api/whatsapp/webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
  body: payload,
});
console.log(`${response.status} ${await response.text()}`);
