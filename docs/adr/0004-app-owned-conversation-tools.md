# ADR 0004: App-owned history and OpenAI tools

Status: Accepted, 2026-09-15.

The application stores bounded sanitized conversation text and rebuilds OpenAI context. Responses API function calls are strict-schema suggestions; Zod parsing, actor scope, domain validation, tool execution records, and transactional keys control side effects.

Depending on WhatsApp history retrieval or OpenAI response IDs alone was rejected because neither is the authoritative durable business context. The database adds retention responsibility but supports deployments, replay, auditing, and model/provider changes.

Affected modules: conversation tables, `respond.ts`, `tools.ts`, OpenAI adapter, retention runbook.

2026-09-16 extension: the admin inbox projects retained original inbox/outbox records so readers see actual received text and cross-recipient notifications. It shares no write path with the Simulator. Separate numeric AI usage records provide observability without persisting provider response content.

2026-09-16 conversation extension: strict structured final replies carry the AI's text, unrestricted language code, and interactive labels. Verified staff receive role-specific capability introductions. Owner/technician listing tools query current scoped database records; a service-only SQL aggregate supplies complete summaries with explicit created/appointment date basis. Tool and SQL scope checks use stored identity, never model claims.
