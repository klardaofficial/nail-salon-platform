# Architecture overview

```mermaid
flowchart LR
  WA[WhatsApp Cloud API] -->|signed WABA + phone metadata| Edge[Root or organization webhook]
  Edge --> Scope[Organization resolver]
  Scope --> DB[(Supabase PostgreSQL)]
  Scope --> Jobs[Inngest]
  Jobs --> Conversation[Organization conversation service]
  Conversation --> OpenAI[Organization OpenAI configuration]
  Conversation --> DB
  Jobs --> Outbox[Organization message outbox]
  Outbox --> WA
  Jobs --> Preview[Memory-only preview pipeline]
  Admin[Ant Design admin + SWR] --> API[Scoped admin handlers]
  API --> Auth[Supabase Auth + memberships]
  API --> DB
```

`organizations` is the tenant root; each owns one customer-facing business profile. Every operational row, durable event, worker payload, provider call, and dashboard path carries the organization ID. Composite foreign keys and tenant-first uniqueness prevent cross-organization parent references and idempotency collisions.

The permanent root webhook routes each change independently by signed WABA/receiving-phone metadata. A dynamic organization callback supports a separate Meta app. Provider secrets are loaded server-side after scope is fixed and never enter job payloads. Simulator events use the same organization context and domain tools but a distinct channel and delivery transport.

Next.js owns UI and trusted route handlers. Supabase owns Auth, durable state, RLS, and atomic operations. Inngest runs retryable work outside the webhook response. Dependency direction is `app edge -> feature/domain -> provider adapter`; provider adapters do not decide domain rules. Browser data access uses organization-prefixed APIs and shared SWR fetchers, never direct service-role access.
