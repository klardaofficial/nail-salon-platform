# Testing

Run the complete application suite with:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

`pnpm check` runs these in order. Application tests cover WhatsApp signature verification/normalization, analytics cohorts/timezone grouping, simulator routing/authorization, and UI behavior. They do not execute or inspect Supabase migration SQL. Do not add or maintain automated migration tests; the quality workflow runs application checks only.

`pnpm lint` enables type-aware `@typescript-eslint/no-deprecated` as an error for TypeScript source and tests. This makes `pnpm check` and the quality workflow reject deprecated APIs identified by dependency declarations; TypeScript compilation alone does not reject these editor diagnostics. Runtime-only deprecations without type annotations still require runtime verification.

Resource form regression tests render the real Ant Design controls and cover salon default times, saved times, `HH:mm` create/update payloads without a business selector, and restoring defaults after editing.

Simulator tests cover admin/flag gates, identity grouping and spoof rejection, signed ingestion and duplicate/recovery behavior, channel separation, technician notification routing, durable simulated delivery after disabling, and real delivery while enabled. UI acceptance covers customer add/remove/reopen, database staff windows, independent message composers, interactive replies, polling/error states, and browser persistence. Use [the browser simulator](local-setup.md#browser-whatsapp-simulator) for manual booking/owner/technician scenarios; these mutate the configured development database and use OpenAI for natural conversations.

When intentionally rebuilding the local database after a schema change, the operational commands are:

```bash
pnpm db:reset
pnpm db:types
```

`pnpm db:reset` erases local data; it is not part of the test suite. Keep application acceptance coverage for duplicate inbound events, replayed booking keys, customer-only cancellation before start, nullable/missing technician IDs, no services/staff, multi-service snapshots, and the singleton-business boundary. Use application-level tests or the simulator with synthetic contacts, never image base64.

Live dev-provider tests are intentional and manual because they cost money and send messages: webhook challenge/signature, typed and interactive booking paths, template notification outside a service window, image edit/upload/delivery, OpenAI tool replay, and Inngest recovery. Do not run them against production customers.
