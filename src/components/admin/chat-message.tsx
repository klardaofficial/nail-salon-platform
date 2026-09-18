"use client";

import { Button } from "antd";
import type { ChatMessage, ChatReply } from "@/features/messaging/chat";

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

const bubbleBase =
  "max-w-[92%] border border-[#dde3e0] rounded-[10px] px-3 pt-[10px] pb-[7px] shrink-0 [overflow-wrap:anywhere]";
const bubbleOutgoing = "self-end bg-[#e2f2e6] border-[#cde2d3] rounded-tr-[3px]";
const bubbleIncoming = "self-start bg-white rounded-tl-[3px]";
const senderLabel = "block mb-[5px] text-[#57665b] text-[11px] font-semibold";
const choiceSmall = "block text-[11px] text-admin-muted font-normal";

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
    <div className={`${bubbleBase} ${outgoing ? bubbleOutgoing : bubbleIncoming}`}>
      <span className={senderLabel}>
        {message.direction === "inbound" ? contactName : "Salon assistant"}
      </span>
      <div className="text-sm leading-[1.55] whitespace-pre-wrap">{message.text}</div>
      {message.mediaId ? (
        <div className="text-admin-muted mt-[6px] text-xs">
          Image attachment · WhatsApp media ID: {message.mediaId}
          <br />
          Image preview unavailable.
        </div>
      ) : null}
      {interactive ? (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {interactive.kind === "list" ? (
            <span className={senderLabel}>
              {interactive.buttonLabel} · {interactive.sectionTitle}
            </span>
          ) : null}
          {interactive.options.map((option) => {
            const title = option.title.slice(0, interactive.kind === "buttons" ? 20 : 24);
            const content = (
              <span>
                {title}
                {option.description ? (
                  <small className={choiceSmall}>{option.description.slice(0, 72)}</small>
                ) : null}
              </span>
            );
            return onReply ? (
              <Button
                key={option.id}
                block
                size="small"
                className="admin-chat-choice min-h-8 text-left"
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
              <div
                key={option.id}
                className="rounded-md border border-[#dde3e0] px-2.5 py-2 text-[13px]"
              >
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
      <div
        className={`mt-[6px] flex flex-wrap justify-end gap-2 text-[10px] text-[#65726a] ${message.state === "failed" ? "text-[#b42318]" : ""}`}
      >
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
