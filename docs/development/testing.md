# Testing

Run the complete application suite with:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

`pnpm check` runs these in order. Unit tests cover WhatsApp signature verification/normalization, analytics cohorts/timezone grouping, schema storage contracts, and full migration execution in embedded PostgreSQL. The embedded prelude emulates Supabase Auth roles; it cannot validate the entire managed Supabase stack.

With Docker Desktop, also run:

```bash
pnpm db:reset
pnpm exec supabase db lint --local --level error
pnpm db:types
```

Database acceptance scenarios should cover duplicate inbound events, replayed booking keys, customer-only cancellation before start, nullable/missing technician IDs, no services/staff, multi-service snapshots, concurrent quota reservations, and platform/business isolation. Use synthetic contacts and never image base64.

Live dev-provider tests are intentional and manual because they cost money and send messages: webhook challenge/signature, typed and interactive booking paths, template notification outside a service window, image edit/upload/delivery, OpenAI tool replay, and Inngest recovery. Do not run them against production customers.
