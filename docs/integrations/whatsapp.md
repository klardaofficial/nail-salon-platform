# WhatsApp integration

The Graph API is pinned to `v26.0`. Meta credentials start empty and are stored through server-only database settings; runtime and bootstrap do not read Meta environment values.

## Callbacks and routing

- `GET|POST /api/whatsapp/webhook` is the permanent root callback. GET uses the root verify token. POST verifies the exact body with the root app secret, then routes each change independently by `entry.id` WABA and `value.metadata.phone_number_id`, confirms its effective app secret, and registers the matching organization.
- `GET|POST /api/whatsapp/webhook/{organizationId}` uses that organization's effective complete override and rejects the whole request unless every change matches the path organization's WABA and phone.

Both callbacks normalize routing metadata on messages and statuses. Missing/unknown/mismatched routing writes no tenant work. Organization/event uniqueness makes duplicate delivery through both valid routes one effect. Archived organizations reject new messages but may reconcile delivery statuses. Callback builders add `x-vercel-protection-bypass` from the server-only bypass secret with URL encoding when configured.

Ingress persists organization scope through inbox, job outbox, Inngest event, contact/conversation, domain tools, previews, AI usage, and message outbox. Jobs contain identifiers, not credentials. Delivery reloads current effective credentials and refuses real sending unless the active organization is validated and enabled. Status updates match both organization and provider message ID.

## Provider readiness and QR

Provider configuration is Incomplete, Unvalidated, Invalid, Ready/disabled, or Enabled. WABA, phone, credential-source, access-token, or root-credential changes invalidate validation. Validation checks phone access and WABA ownership through Meta, then stores only sanitized status plus the returned display/E.164 number. Customer click-to-chat is exactly `https://wa.me/{digits}`; QR SVG is generated locally and is shown only for a current enabled mapping.

Technician template selection is resolved before queueing. The immutable outbox payload retains template name, language, five parameters, and source so retries do not change meaning. Blank organization templates under an override mean ordinary localized messages; root templates are inherited only with root Meta credentials.

The authenticated organization simulator uses the same normalized event/domain path with a simulated marker supplied by trusted server code. Its captured outbound messages never invoke Meta and cannot be enabled by public webhook content.
