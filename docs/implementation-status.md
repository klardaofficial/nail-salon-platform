# Implementation status

Last reviewed: 2026-09-16.

## Implemented

- Adaptive conversation language without a language allowlist: BOT_LOCALE is a valid language-tag reference; AI generates contextual greetings and every WhatsApp option/list label. Admin greeting settings and English/German dictionaries are removed. Conversation language and AI-written outage text are retained per channel.
- One focused booking question at a time, optional catalog/staff questions skipped, explicit complete booking requests confirmed immediately, null salon support when none is active, and [N/A] displays. Additive local migrations applied without resetting data; types regenerated.
- Verified owner/technician greetings explain staff capabilities in their conversation language. Paginated scoped record tools and service-only SQL summaries provide current database results without page-limit truncation; staff tools recheck mappings. Ordinary notifications and preview captions use AI localization; approved Meta templates retain their provider contract.

- Platform activity below booking reports: shared dates/timezone, selectable real/simulated/all sources, received/sent messages, distinct active senders, daily trends, chart/table equivalents, and matching CSV export.
- Numeric AI usage records for each chat round and image generation call, including source/model/status, available tokens, generated output counts, configurable snapshotted USD estimates, unpriced coverage, and a paginated request log. Historical usage cannot be backfilled.
- Read-only WhatsApp inbox for customers, owners, and technicians, including outbound-only notifications, verified current roles, search/filter/pagination, older-message cursors, and mobile list/detail navigation. It reuses the Simulator's message bubbles and interactive-option presentation; image attachments remain media-ID placeholders.
- Additive observability migration applied locally without resetting data. Database types regenerated; `pnpm db:types` now preserves the file on failure and supports the running local metadata service as a fallback when Docker management is unavailable.

- Next.js App Router scaffold with a German responsive landing page and English Ant Design admin shell.
- Supabase Auth login, protected admin routes, migration-created initial account, UI-required first password change, and authenticated later password changes.
- Admin SWR APIs and Ant Design screens for the one business profile/owners, salon locations, services, technicians, settings, bookings, analytics, and CSV export. Settings explain and store the optional approved technician WhatsApp notification-template names, including the Meta body placeholders.
- The Business profile uses cards and includes a safe Meta WhatsApp Developer setup checklist with the current webhook callback URL, verify-token instructions, and `messages` subscription guidance; it never displays provider secrets.
- Salon create/edit forms normalize time defaults and saved values for Ant Design pickers, serialize `HH:mm` API payloads, and restore defaults when adding after editing.
- Supabase migrations with a database-enforced singleton business profile, snapshots, RLS, transactional inbound/booking/cancellation/preview functions, audit data, and durable queues. Local and production contain no salon/customer seed data.
- WhatsApp Graph API v26.0, verification/signature handling, normalization, duplicate-safe inbox registration, text/image/button/list transport, delivery tracking, and a signed local simulator.
- App-owned conversation history, adaptive conversation language, active catalog context, OpenAI Responses API loop, strict function tools, server-side role checks, and idempotent tool execution.
- Customer booking/cancellation/preview tools, owner summary/catalog/salon tools, technician assigned-booking/time-off tools, and technician notifications.
- In-memory image download, OpenAI edit, direct WhatsApp upload, quota reservation/reconciliation, retryable delivery by saved media ID, and stale-work recovery.
- Confirmed/cancelled, unique customer, returning customer, repeat-rate, trends, recent activity, health counts, and CSV reporting.
- Overview reporting uses a selectable calendar date range, defaults to the current month, and provides quick ranges in the picker footer.
- GitHub quality workflow. Vercel application deployment and Supabase migration deployment are handled by their respective GitHub integrations.
- Repository Prettier, ESLint, EditorConfig, WebStorm guidance, tests, and agent documentation.
- Type-aware ESLint rejects deprecated TypeScript API usage as part of `pnpm lint`, `pnpm check`, and the existing quality workflow.
- Pinned Inngest dev-server CLI and a documented keyless local workflow through `pnpm inngest:dev`.
- Environment-gated admin web WhatsApp simulator for local and hosted use alongside real traffic: persistent browser customer windows, database-backed owner/technician windows, text/interactive chats, processing status, and captured replies/notifications. It shares real domain tools and data while isolating simulated histories and durable delivery routing. Meta credentials are unnecessary for browser simulation.

## Verified locally

- `pnpm check`: formatting, lint, TypeScript, all 89 application tests, and the production build pass, including unrestricted language/interactive replies, flexible bookings, staff query tools, and existing dashboard/inbox/reporting routes.

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- Application tests cover WhatsApp verification/normalization, analytics, simulator authorization/routing, shared chat UI interactions, read-only inbox pagination/source isolation, reporting API/CSV consistency, AI pricing/recording failures, and salon form time defaults/save behavior. Supabase migration tests and the database-test CI job were removed by project decision; they must not be reintroduced.
- `pnpm build`: production build and all routes compile.
- Local Inngest dev server 1.44.0 syncs successfully; `/api/inngest` reports HTTP 200, dev mode, no cloud keys, and four registered functions.
- Supabase CLI 2.117.0 starts. Local database rebuild/type-generation commands remain available for schema development, but migration execution/reset/lint is not part of the application quality workflow.

## Provider validation still required

- Configure real dev Supabase, Meta WhatsApp, OpenAI, Inngest, and Vercel projects.
- Verify Meta webhook subscription, customer-service windows and approved technician notification templates with the real dev number.
- Run a controlled OpenAI preview smoke test and confirm the configured model IDs are available to the account.
- Exercise the complete signed webhook to delivered reply path, initial password-change flow/persistence, and configured-business owner access against dev infrastructure.

These are deployment prerequisites and live integration checks. They require provider credentials; no salon owner setup is needed for them.
