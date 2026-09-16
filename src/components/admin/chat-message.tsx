"use client";

import { Button } from "antd";
import type { ChatMessage, ChatReply } from "@/features/messaging/chat";
import styles from "./chat-message.module.css";

const stateLabels: Record<string, string> = {
  pending: "Queued",
  dispatched: "Queued",
  processing: "Processing",
  completed: "Processed",
  processed: "Processed",
  sending: "Sending",
  sent: "Sent",
  captured: "Simulated delivery",
  failed: "Failed",
};

export function ChatMessageBubble({
  message,
  contactName,
  perspective = "contact",
  onReply,
  busy = false,
}: {
  message: ChatMessage;
  contactName: string;
  perspective?: "contact" | "business";
  onReply?: (reply: ChatReply) => void;
  busy?: boolean;
}) {
  const payload = message.payload;
  const interactive = payload?.kind === "buttons" || payload?.kind === "list" ? payload : null;
  const outgoing = message.direction === (perspective === "business" ? "outbound" : "inbound");
  const delivered = message.state === "captured" || message.state === "sent";
  return (
    <div className={`${styles.bubble} ${outgoing ? styles.outgoing : styles.incoming}`}>
      <span className={styles.sender}>
        {message.direction === "inbound" ? contactName : "Salon assistant"}
      </span>
      <div className={styles.messageText}>{message.text}</div>
      {message.mediaId ? (
        <div className={styles.media}>
          Image attachment · WhatsApp media ID: {message.mediaId}
          <br />
          Image preview unavailable.
        </div>
      ) : null}
      {interactive ? (
        <div className={styles.choices}>
          {interactive.kind === "list" ? (
            <span className={styles.sender}>
              {interactive.buttonLabel} · {interactive.sectionTitle}
            </span>
          ) : null}
          {interactive.options.map((option) => {
            const title = option.title.slice(0, interactive.kind === "buttons" ? 20 : 24);
            const content = (
              <span>
                {title}
                {option.description ? <small>{option.description.slice(0, 72)}</small> : null}
              </span>
            );
            return onReply ? (
              <Button
                key={option.id}
                block
                size="small"
                className={styles.choice}
                disabled={busy || !delivered}
                onClick={() =>
                  onReply({
                    kind: "interactive",
                    replyType: interactive.kind === "buttons" ? "button_reply" : "list_reply",
                    id: option.id.slice(0, interactive.kind === "buttons" ? 256 : 200),
                    title,
                  })
                }
              >
                {content}
              </Button>
            ) : (
              <div key={option.id} className={styles.readOnlyChoice}>
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
      <div className={`${styles.messageMeta} ${message.state === "failed" ? styles.failed : ""}`}>
        <time dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        <span>{stateLabels[message.state] ?? message.state}</span>
      </div>
    </div>
  );
}
