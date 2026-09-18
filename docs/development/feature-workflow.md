# Feature workflow

1. Read `AGENTS.md`, the relevant requirement ID and task-specific document, and existing tests.
2. Trace the request from route/job to feature service, provider adapter, and SQL. Put each rule in one feature/domain location.
3. Make the smallest complete change, including failure and retry behavior.
4. Update required docs and meaningful tests, then run `pnpm check`.

For a new conversation tool, add strict JSON Schema and Zod parsing, actor scope checks, idempotency behavior, safe tool output, prompt guidance, flow examples, and evaluation cases. For a setting, update env/dashboard schema, API mapping, defaults, configuration docs, and decide whether it requires redeploy.

For a catalog or booking field, add a new migration, snapshot/history behavior, indexes/RLS, admin form/API, conversation catalog/tool parsing, generated types, and data-model docs. Never retrofit a foreign key onto `bookings.technician_ref`.

For a notification, define recipient-window/template behavior, deduplication key, outbox payload, retry status, and recovery signal. For a metric, change the shared cohort query/calculator, graph, accessible table, CSV labels, formula/example, and tests together.
