# Conversation state

One `conversations` row exists per WhatsApp contact/channel. Bounded text history lives in `conversation_messages`; media fields store IDs only. A single `booking_drafts` row collects salon, interpreted timestamp, service snapshots, soft technician reference, and optional request. Draft state moves from `collecting` to `completed`; no draft field is required except by the final booking tool.

The processor builds context from the latest 18 text messages, active catalog, current draft, owner memberships, technician IDs, current UTC time, and a recent media ID. It calls OpenAI with `store: false`, fixed `BOT_LOCALE` instructions, strict function schemas, and serial tool calls. The app replays its own history instead of depending on WhatsApp or OpenAI to return old chats.

Inngest concurrency serializes events by contact WA ID. Provider message IDs are unique in conversation history, webhook events are unique in the inbox, tool calls are unique by conversation/call ID, and booking inserts use a conversation/call idempotency key. A greeting uses a conditional null update so concurrent first messages claim it once.

Interactive selections contain stable IDs. Tools revalidate current activity/scope, so stale options fail safely. Failed job dispatch remains in `job_outbox`; failed/pending outbound messages remain in `message_outbox`. A scheduled recovery function redispatches both and releases preview reservations left stale for 30 minutes.
