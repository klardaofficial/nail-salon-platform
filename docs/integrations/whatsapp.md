# WhatsApp integration

The Graph API is pinned to `v26.0`. Meta credentials start empty and are stored through server-only database settings; runtime and bootstrap do not read Meta environment values.

## Callbacks and routing

- `GET|POST /api/whatsapp/webhook` is the permanent root callback. GET uses the root verify token. POST verifies the exact body once with the root app secret, then routes each change independently by `entry.id` WABA and `value.metadata.phone_number_id`. It registers only matching organizations whose credential source is the root bundle.
- `GET|POST /api/whatsapp/webhook/{organizationId}` is the callback shown in Organization Settings. It uses the organization's complete credential override when present and otherwise falls back to the root credential bundle. It rejects the whole request unless every change matches the path organization's WABA and phone.

Both callbacks normalize routing metadata on messages and statuses. Missing, unknown, mismatched, or wrong-credential-source routing writes no tenant work. Organization/event uniqueness makes retries one effect. Archived organizations reject new messages but may reconcile delivery statuses. Malformed payloads return 400; persistence failures return 500 so Meta can retry.

Ingress persists organization scope through inbox, job outbox, Inngest event, contact/conversation, domain tools, previews, AI usage, and message outbox. Jobs contain identifiers, not credentials. An active organization's successfully validated mapping automatically accepts real traffic. Delivery reloads current effective credentials and refuses real sending unless that active mapping remains valid. Status updates match both organization and provider message ID.

## Provider readiness and QR

Provider configuration is Incomplete, Unvalidated, Invalid, Ready/disabled for an archived organization, or Enabled. WABA, phone, credential-source, access-token, or root-credential changes invalidate validation. Validation checks phone access and WABA ownership through Meta, then stores only sanitized status plus the returned display/E.164 number. A successful validation enables an active organization automatically. Customer click-to-chat is exactly `https://wa.me/{digits}`; QR SVG is generated locally and is shown only for a current enabled mapping.

## Booking-intent prefill entry point

`GET /api/public/{organizationId}/booking-intent` (see `docs/architecture/authorization.md` and BOOK-07 in `docs/product/requirements.md`) is a second, prefilled variant of click-to-chat for a customer arriving from an external booking website rather than a QR code: `https://wa.me/{digits}?text={encoded}`. That external website discovers this endpoint's own URL, plus the organization's catalog UUIDs, timezone, and hours, from the public `GET /api/public/{organizationId}/catalog` endpoint (BOOK-08) — see `docs/integrations/external-booking-website.md` for the integration guide aimed at whoever builds that site. It requires the same Enabled readiness as the QR endpoint. The prefilled text always leads with a `[BK-xxxxxxxxxxxxx]` code — appended after message generation, never part of the AI payload — because WhatsApp truncates long prefill text in practice and a trailing code is what gets cut. The message body itself is AI-written in the organization's `bot_locale` through `createLocalizedText` when available, bounded by a per-organization hourly cap, and otherwise a deterministic English template; identical repeated requests reuse the same code and byte-identical text rather than generating new ones. Sending that message lets the inbound pipeline claim the code and seed the booking draft with the exact catalog UUIDs the website chose (see `docs/architecture/conversation-state.md`).

Technician template selection is resolved before queueing. The immutable outbox payload retains template name, language, five parameters, and source so retries do not change meaning. Blank organization templates under an override mean ordinary localized messages; root templates are inherited only with root Meta credentials.

The authenticated organization simulator uses the same normalized event/domain path with a simulated marker supplied by trusted server code. Its captured outbound messages never invoke Meta and cannot be enabled by public webhook content.
