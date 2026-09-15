# ADR 0002: Inngest durable jobs on Vercel

Status: Accepted, 2026-09-15.

Webhook handlers persist an inbox plus job-outbox row and return quickly. Inngest processes conversation work, outbound delivery, previews, and two-minute recovery. State-changing chat runs serialize by contact; provider retries remain idempotent.

Synchronous webhook processing was rejected because provider/OpenAI latency exceeds reliable callback budgets. A database-only polling worker was rejected for initial scope because Vercel has no continuously running process. Durable rows remain the recovery source if event dispatch fails.

Affected modules: `src/inngest`, WhatsApp webhook, message/job outboxes, operations runbooks.
