# WhatsApp integration

The Graph API is pinned to `v26.0`. Meta credentials start empty and are stored through server-only database settings; runtime and bootstrap do not read Meta environment values.

## Callbacks and routing

- `GET|POST /api/whatsapp/webhook` is the permanent root callback. GET uses the root verify token. POST verifies the exact body once with the root app secret, then routes each change independently by `entry.id` WABA and `value.metadata.phone_number_id`. It registers only matching organizations whose credential source is the root bundle.
- `GET|POST /api/whatsapp/webhook/{organizationId}` is the callback shown in Organization Settings. It uses the organization's complete credential override when present and otherwise falls back to the root credential bundle. It rejects the whole request unless every change matches the path organization's WABA and phone.

Both callbacks normalize routing metadata on messages and statuses. Missing, unknown, mismatched, or wrong-credential-source routing writes no tenant work. Organization/event uniqueness makes retries one effect. Archived organizations reject new messages but may reconcile delivery statuses. Malformed payloads return 400; persistence failures return 500 so Meta can retry.

Ingress persists organization scope through inbox, job outbox, Inngest event, contact/conversation, domain tools, previews, AI usage, and message outbox. Jobs contain identifiers, not credentials. An active organization's successfully validated mapping automatically accepts real traffic. Delivery reloads current effective credentials and refuses real sending unless that active mapping remains valid. Status updates match both organization and provider message ID.

## Provider readiness and QR

Provider configuration is Incomplete, Unvalidated, Invalid, Ready/disabled for an archived organization, or Enabled. WABA, phone, credential-source, access-token, or root-credential changes invalidate validation. Validation reads the configured phone node for its ID and display number, then reads the configured WABA's `phone_numbers` edge and requires that list to contain the configured phone ID. It stores only sanitized status plus the returned display/E.164 number. A successful validation enables an active organization automatically. Customer click-to-chat is exactly `https://wa.me/{digits}`; QR SVG is generated locally and is shown only for a current enabled mapping.

## Booking-intent prefill entry point

`GET /api/public/{organizationId}/booking-intent` (see `docs/architecture/authorization.md` and BOOK-07 in `docs/product/requirements.md`) is a second, prefilled variant of click-to-chat for a customer arriving from an external booking website rather than a QR code: `https://wa.me/{digits}?text={encoded}`. That external website discovers this endpoint's own URL, plus the organization's catalog UUIDs, timezone, and hours, from the public `GET /api/public/{organizationId}/catalog` endpoint (BOOK-08) — see `docs/integrations/external-booking-website.md` for the integration guide aimed at whoever builds that site. It requires the same Enabled readiness as the QR endpoint. The prefilled text always leads with a `[BK-xxxxxxxxxxxxx]` code — appended after message generation, never part of the AI payload — because WhatsApp truncates long prefill text in practice and a trailing code is what gets cut. The message body itself is AI-written in the organization's `bot_locale` through `createLocalizedText` when available, bounded by a per-organization hourly cap, and otherwise a deterministic English template; identical repeated requests reuse the same code and byte-identical text rather than generating new ones. Sending that message lets the inbound pipeline claim the code and seed the booking draft with the exact catalog UUIDs the website chose (see `docs/architecture/conversation-state.md`).

Technician template selection is resolved before queueing. The immutable outbox payload retains template name, language, five parameters, and source so retries do not change meaning. Blank organization templates under an override mean ordinary localized messages; root templates are inherited only with root Meta credentials.

## Cancel button

Every booking confirmation — AI-written or scripted (see BOT-01 in `docs/product/requirements.md`) — carries a single interactive option whose id is `booking:cancel:<uuid>`, the booking's own id, rather than an opaque token the server has to look up. The normalizer already captures `button_reply.id`/`list_reply.id` verbatim as `message.interactiveId`, and a button/list id may be up to 256 characters, so the full UUID fits with room to spare. A tap is recognized by parsing that prefix before anything else runs — ahead of AI dispatch and ahead of the scripted priority chain — so cancellation never depends on conversation history or the model. The button's title text (the localized `cancelAction` string in `src/lib/bot/static-messages.ts`, reused for the AI-enabled path too) must stay at or under WhatsApp's 20-character button-title cap in every supported language; list rows get 24.

## Booking reminders

Each organization configures its own list of reminder times (BOOK-11 in `docs/product/requirements.md`) — a number plus a unit of hours or days before `starts_at` — with no root/system default list; the default is empty. One shared Meta template, resolved with the same organization-over-root precedence as the technician templates (`booking_reminder_template` on both `organization_provider_settings` and `root_settings`), serves every configured time. Its body takes exactly two positional parameters: `{{1}}` the customer's name and `{{2}}` the appointment's already-localized time (`bookings.local_time_label`).

Unlike the technician notification below, **there is no plain-text fallback**: a reminder is a business-initiated message sent long after the customer's own message opened (or re-opened) the 24-hour window, so Meta will reject it as free-form text. If no reminder template resolves for an organization — neither its own nor the root default — no reminders are sent for that organization at all, and Organization Settings shows a warning whenever reminder times are configured without a resolved template.

Delivery is a periodic scan (`queueDueBookingReminders` in `src/features/bookings/reminder-delivery.ts`), folded into the existing five-minute `recover-durable-outboxes` Inngest cron as an additional step rather than a separate scheduled function, since Inngest bills per function run and that cron already ticks on the schedule the scan needs. For each configured `(organization, offset)` pair, it selects `confirmed` bookings whose `starts_at` falls in a short window around `now + offset`, wide enough to overlap between ticks so a single missed run still delivers. Each reminder is queued through the same durable outbox as every other outbound message, with `deduplicationKey: booking:{bookingId}:reminder:{offsetMinutes}` — keyed on the offset rather than the reminder rule's row id, so deleting and re-adding an identical time can never re-send or double-send a reminder.

## Ordinary technician notification without a template

When no Meta template is configured, the notification body is normally AI-written in the technician's stored conversation language. With `ai_bot_enabled = false`, there is no AI call available, so the same body is instead built from the static `technicianConfirmed`/`technicianCancelled` templates in `src/lib/bot/static-messages.ts`, keyed by the organization's `bot_locale`. The Meta template path itself, and the notification's dedup keys, are unaffected by this toggle.

The authenticated organization simulator uses the same normalized event/domain path with a simulated marker supplied by trusted server code. Its captured outbound messages never invoke Meta and cannot be enabled by public webhook content.
