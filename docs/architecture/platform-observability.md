# Platform activity and WhatsApp inbox

The authenticated admin routes own all browser access. They call `requireApiAdmin` before creating the service-role client, validate filters, and return private, non-cacheable responses. SWR keys include the selected dates/source or conversation/search/page. Polling refreshes activity every 15 seconds and the inbox every 10 seconds.

## Read models

`admin_whatsapp_messages` is a security-invoker view over original message inbox events and durable outbound rows. It excludes delivery callbacks, preserves received interactive labels/text, includes messages still processing, and includes staff notifications without a conversation. It does not union conversation context history, which would double count messages and expose normalized AI-context wording. No new transcript copies are stored.

`admin_whatsapp_threads` groups by WA ID within one explicit channel, orders by latest inbound/outbound activity, and performs name/number search and role filtering before pagination. Names prefer contacts, then active technician mappings, then stored profile names or WA IDs. Owner/technician badges use current verified mappings, not claims in chat. Both roles can apply. Notifications addressed to people who have not chatted still create an inbox entry.

`GET /api/admin/inbox` returns 30 threads per page. `GET /api/admin/inbox/messages` returns 50 messages with a cursor containing timestamp and ID; the ID breaks timestamp ties. Older pages are available without a lifetime transcript cap. The UI deduplicates rows when pages refresh, preserves the scroll position while loading older messages, and follows incoming messages only when already near the bottom. Mobile uses a conversation list and a back button.

The inbox has no write endpoint, composer, or interactive-reply callback. `ChatMessageBubble` shares sender labels, text, timestamps, state, styling, and interactive option rendering with the Simulator. Only the Simulator supplies the callback that makes options clickable. The inbox reads both retained channels independently of whether simulator sends are enabled. Images show a caption and media ID; no image download, filesystem storage, media proxy, or image fixtures are introduced. Templates show their stored name and parameters.

The activity RPC aggregates at the database, with date bounds and source filtering applied before grouping. Its daily buckets and the period distinct-sender count have separate definitions; see [analytics](../product/analytics.md). Inbox views and both reporting functions are service-role-only, even though their underlying tables retain RLS.

## AI usage

`ai_usage_events` records a UUID per SDK invocation before calling OpenAI. An insertion failure stops that invocation before spending. It stores only identifiers, model/source/type, timestamps/status, numeric counters, bounded failure codes, a configured price snapshot, and an optional estimated USD cost. Every Responses round is wrapped. Image usage is recorded after generation and before decoding/uploading outputs.

Successful responses update the same row; provider failures leave unknown usage/cost and a generic failure code. An interrupted process or a failed completion write leaves a visible `started` row. A completion-write failure emits only a fixed diagnostic and usage UUID, and does not turn a successful paid call into a retry. The normal SDK retry behavior is preserved; internal HTTP retries are not individually counted. Application retries that invoke the provider again receive another usage row. Saved preview media IDs still avoid regeneration on ordinary delivery retries.

Pricing is keyed by the exact configured model name and operation kind. No rates are assumed; missing or mismatched rates remain unknown. Historical estimates retain their price snapshots. AI usage starts with this release and does not estimate tokens from message lengths. Normal provider billing and retention policies still apply.

Apply migration `202609160001_platform_activity_inbox.sql` before deploying the instrumented application, then run `pnpm db:types`. It adds numeric usage storage, indexes, and read models without rebuilding or deleting existing data.
