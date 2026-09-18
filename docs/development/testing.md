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

Vitest uses typed configuration and `fileParallelism: false` to run files serially. This is the current equivalent of the former, ignored `singleThread` setting and prevents concurrent Ant Design/Phosphor UI imports from exhausting Windows file handles.

Admin frontend behavior is verified manually in the browser. Automated tests cover API, feature, integration, and domain behavior, but do not render React UI components.

Observability acceptance covers admin gates on inbox/activity/log/CSV routes, date/timezone boundaries, pagination/cursors, source isolation, pricing with cached and image tokens, missing usage, completion-write failures, CSV consistency, and read-only inbox interactions. The Simulator's existing interactive tests also exercise the shared message renderer. These remain application tests; no automated migration tests are added.

Simulator tests cover admin/flag gates, identity grouping and spoof rejection, signed ingestion and duplicate/recovery behavior, channel separation, technician notification routing, durable simulated delivery after disabling, and real delivery while enabled. Manually verify customer add/remove/reopen, database staff windows, independent message composers, interactive replies, polling/error states, and browser persistence with [the browser simulator](local-setup.md#browser-whatsapp-simulator). These scenarios mutate the configured development database and use OpenAI for natural conversations.

Conversation recovery regressions cover failure after saving inbound history on both channels, resuming the reply, redispatching an existing reply without another AI call, skipping completed events, and propagating failed completion writes. Catalog coverage checks the salon interval column and its value in AI context. A controlled local simulator greeting was retried through Inngest and verified with completed OpenAI usage plus a captured interactive reply.

When intentionally rebuilding the local database after a schema change, the operational commands are:

```bash
pnpm db:reset
pnpm db:types
```

`pnpm db:reset` erases local data; it is not part of the test suite. Keep application acceptance coverage for duplicate inbound events, replayed booking keys, customer-only cancellation before start, nullable/missing technician IDs, no services/staff, multi-service snapshots, and the singleton-business boundary. Use application-level tests or the simulator with synthetic contacts, never image base64.

Live dev-provider tests are intentional and manual because they cost money and send messages: webhook challenge/signature, typed and interactive booking paths, template notification outside a service window, image edit/upload/delivery, OpenAI tool replay, and Inngest recovery. Do not run them against production customers.

Dynamic conversation coverage includes arbitrary language tags (Vietnamese, Thai, Japanese, Arabic and regional tags), strict output limits, preservation of AI option/list labels, one contextual reply, localized outage fallback, role-specific capabilities, current staff mapping checks, paginated owner/technician reads, database summary tool scoping, nullable-salon bookings, sole/multiple/stale salon behavior, offset timestamps, optional services/technicians, successful-tool receipts after AI failure, and removal of admin greeting inputs from the API contract.

Date/time regressions cover platform timezone precedence over salon/draft settings, server-owned draft timezone, midnight and daylight-saving formatting, historical booking labels for customer/owner/technician lists, confirmed/cancelled notification inputs, and neutral outage receipts without timezone suffixes. Prompt contract checks cover personal-timezone independence and omission of timezone names, offsets and explanations in every visible message/control; actual model adherence remains a manual provider evaluation.

Local schema changes are applied additively using `pnpm db:migration` with existing data retained, then `pnpm db:types`. The staff-summary and nullable-booking migrations have no automated migration tests. Live evaluations should additionally inspect natural conversational quality in multiple languages, long/non-Latin labels, staff greetings, date interpretation, and mixed typed/interactive paths.
