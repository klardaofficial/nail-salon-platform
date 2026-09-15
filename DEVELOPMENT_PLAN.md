# Nail Salon WhatsApp Platform — Development Plan

Status: ready for implementation planning and execution by a future coding agent.
Created: 2026-09-15.
Scope of this artifact: requirements, architecture, implementation sequence, validation, and maintenance documentation. No application code has been implemented.

Quick navigation: [requirements](#2-agreed-product-requirements), [proposed defaults](#3-proposed-implementation-defaults), [architecture](#4-system-architecture), [data model](#5-data-model-and-isolation), [CI/CD](#9-environments-migrations-and-cicd), [required documentation](#10-documentation-required-during-coding), [implementation phases](#11-implementation-phases), and [coding-agent starter instruction](#16-starter-instruction-for-a-future-coding-agent).

## 1. How to use this plan

This document captures the requirements agreed with the product owner. Build the application incrementally, with working software and updated documentation at each phase.

The product prioritizes attracting customers, friendly conversations, and minimal work for salon owners. It is a flexible booking and customer-engagement application. Do not introduce mandatory attendance tracking, appointment-duration enforcement, capacity limits, or mandatory staff assignment.

Requirement precedence for future work:

1. The user's latest explicit instructions.
2. Agreed product rules in this document and, once created, `docs/product/requirements.md`.
3. Accepted architecture decisions in `docs/adr/`.
4. Implementation conventions and technical defaults.

Clearly distinguish implemented behavior, agreed requirements, proposed defaults, and deferred features. When an authorized change alters a product rule, update its documentation in the same change. Do not silently expand an exception about technician references into weaker authorization or business-data isolation.

## 2. Agreed product requirements

### 2.1 Business and salon structure

- The platform serves multiple independent businesses.
- One business can have multiple owners and multiple salons, with one combined monthly usage report for charging that business.
- Each salon represents one physical location.
- One shared WhatsApp Business number serves all salons in the production environment.
- Customers choose from all active salons across the platform.
- If only one active salon exists across the platform, skip salon selection.
- If multiple active salons exist, the customer must identify a salon for every new booking. A typed salon name or an unambiguous conversational choice counts as selection.
- Links, QR codes, and previous bookings do not silently bypass salon selection. They may provide context for a choice.
- Data belonging to one business must remain isolated from other businesses, even though the WhatsApp number is shared.

### 2.2 Interfaces and roles

| Role or surface        | Interface               | Capabilities                                                                                                                                                                         |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer               | WhatsApp                | Find a salon, get nail-style advice, request image previews, book, see their booking details, and cancel before the appointment starts.                                              |
| Owner                  | WhatsApp only           | Update salon information; manage services and technicians; configure technician selection; view bookings, customer details, daily/weekly summaries, and recorded staff availability. |
| Technician             | WhatsApp only           | Receive booking/cancellation notifications, view bookings assigned to them, and optionally record time off.                                                                          |
| Platform administrator | Protected web dashboard | Set up businesses/salons, assign owner WhatsApp IDs, CRUD services and technicians, manage defaults/greetings, inspect bookings and usage analytics, and monitor application health. |
| Public visitor         | Marketing website       | See a simple German-language landing page and the shared WhatsApp contact link. Dummy marketing content is sufficient initially.                                                     |

An identity may be both an owner, a technician, and a customer. These are contextual permissions, not mutually exclusive account types. Owners and technicians do not need web accounts or a web dashboard.

### 2.3 Setup and administration

- Initial business/salon setup happens in the Admin Dashboard.
- Initial salon information includes its name and location. Admin assigns one or more owner WhatsApp IDs.
- Apply default timezone, suggested time interval, and opening/closing hours automatically.
- Services and technicians are optional during setup. A salon can accept bookings immediately without either.
- Owners have no mandatory onboarding checklist and can update their configuration later through WhatsApp.
- Admin and authorized owners can manage services and technicians for the relevant business/salon.
- Deleting or deactivating catalog/staff records must preserve booking history.
- Technician onboarding requires their WhatsApp identifier/number. Do not depend on looking up an arbitrary person's name or avatar through WhatsApp.
- Use an administrator-entered name or a profile name observed when that person contacts the platform. Avatar lookup is not a launch requirement.

### 2.4 Booking behavior

- Customers can request multiple services in one appointment.
- Offer an `Other` option and an optional additional-request field in the conversation.
- If the salon has no services configured, skip service selection and ask for an optional additional request. Do not block booking.
- Customers provide a desired date and start time. A service's duration, if stored for information, must not determine whether the booking is accepted.
- No salon capacity limit, duration-overlap check, or exclusive technician-slot reservation is required.
- Every successfully created booking starts with status `confirmed`.
- The customer can cancel while the current instant is strictly before the scheduled appointment start. At or after the start, customer self-cancellation is unavailable under the agreed rule.
- Cancelled bookings remain in history and reporting.
- Attendance tracking is not required. A customer who does not attend can still have a `confirmed` booking.
- The launch booking statuses are `confirmed` and `cancelled`. Do not introduce `pending`, `completed`, or `no_show` as required workflow states.
- Booking success is reported only after the database operation succeeds. A notification failure must not undo a successful booking.

### 2.5 Technician assignment and time off

- Owner can enable or disable customer selection of technicians.
- Technician assignment is optional in all cases.
- With selection enabled, show appropriate active technicians for the chosen salon and exclude declared off dates. Include a way to continue without a technician.
- With selection disabled, the implementation may assign an eligible technician automatically; otherwise create an unassigned booking. The proposed assignment rule is specified in section 3.
- Customers can book when no technicians exist or no eligible technicians are available.
- A booking's technician reference may be null or unresolved. The database and application must tolerate both.
- There must be no mandatory foreign-key constraint from a booking's technician reference to a technician record in the initial implementation.
- Resolve nonexistent, deleted, or inaccessible technician references to unassigned behavior. Never expose another business's technician through a loose reference.
- Send technician notifications only when the assignment resolves to an appropriate technician with a usable WhatsApp recipient.
- Technicians can optionally submit or remove time off. It takes effect without an approval workflow.
- Submitted time off changes future selection suggestions. Existing bookings remain confirmed; do not automatically cancel them or require strict conflict resolution.

### 2.6 Natural conversation and optional controls

- Use the OpenAI API, including function calling, for customer conversations and application actions.
- Accept natural language for salon/location, services, technician preference, date/time, and additional requests.
- Examples include `tomorrow at 3 pm`, `Morgen um 15 Uhr`, `a manicure and pedicure`, and `a salon near Berlin Mitte`.
- Reuse information already supplied. Ask concise follow-up questions only for missing or materially ambiguous details.
- Use actual catalog data. The AI must not invent salons, services, technicians, booking IDs, or successful actions.
- Buttons and lists are optional conveniences. Customers can always type instead.
- WhatsApp reply buttons support up to 3 choices; standard list messages support up to 10 rows in total.
- Larger sets need location/name search and additional result pages. Keep every message within WhatsApp's current label and payload limits.
- Standard lists select one item per reply. Support multiple services through repeated `add another`/`done` interaction and through a single natural-language message naming several services.
- A clear first message containing several booking details should advance the draft immediately.
- Do not require a fixed date format, force customers through every menu, or require an extra confirmation screen for an already clear booking request.
- The bot must distinguish an inquiry from an instruction to book or cancel.

### 2.7 Greetings and languages

| Surface                                                    | Language rule                              |
| ---------------------------------------------------------- | ------------------------------------------ |
| Marketing landing page                                     | Always German.                             |
| Admin Dashboard                                            | Always English.                            |
| WhatsApp customer, owner, and technician messages          | English or German, fixed for a deployment. |
| AI replies, image captions, and interactive-control labels | Same fixed bot language.                   |

- Frontend pages do not require an i18n framework.
- Maintain bot translation dictionaries for `en` and `de`.
- Select the bot language through `BOT_LOCALE=en` or `BOT_LOCALE=de`.
- Changing bot language requires changing deployment configuration and redeploying. There is no per-user/per-salon language preference, runtime language switch, or automatic reply-language detection.
- Understanding a customer's input language must not change the configured reply language.
- Use a simple first-contact greeting configured in the Admin Dashboard, not an AI-generated introduction.
- Store greeting wording for each supported bot language. The dashboard can edit wording, but cannot switch the active language.
- Greet on the first inbound customer interaction. Do not depend on a webhook firing merely because someone opens the chat.
- Avoid duplicate greetings on webhook retries and repeated full introductions during one conversation.
- Preserve any booking details in the message that triggered the greeting.
- Customer-entered content, salon names, and service descriptions remain as entered unless an explicit future feature adds content translation.

### 2.8 AI nail-style previews and image handling

- Use OpenAI for image understanding and image generation/editing.
- A customer can upload a hand/nail photo and request previews showing suggested nail styles on that photo.
- Initial quota: 3 preview requests per WhatsApp customer per calendar day across the entire platform.
- Each request can produce at most 3 preview styles: at most 9 previews per customer per day at the default quota.
- These limits are centrally configurable and are not configured separately by each owner.
- Do not persist uploaded images or generated previews in PostgreSQL, Supabase Storage, application files, logs, traces, caches, job payloads, or job checkpoint results.
- Temporary in-memory processing and transfer to WhatsApp/OpenAI are allowed. Avoid filesystem temporary files, including on serverless ephemeral disks.
- Persist only necessary text, media identifiers, delivery status, quota counters, and operational metadata.
- Deliver previews through WhatsApp. WhatsApp and OpenAI have their own retention behavior; do not claim our application storage policy removes their copies.
- If an earlier source image cannot be retrieved from WhatsApp, ask the customer to resend it. A stored text summary is not a substitute for the source pixels when editing an image.

### 2.9 Analytics and charging

- Admin needs accurate counts of total, confirmed, and cancelled bookings by business/salon and period.
- Include unique booking customers, new/returning customers, repeat bookings, and trends.
- Support daily, weekly, and monthly views and exportable monthly business reports.
- The administrator uses these numbers to charge owners. Automatic payment collection or invoice calculation is not required for launch.
- Retention measures repeat booking behavior. Actual visits and attendance cannot be inferred from a booking alone.
- Owners can see their own business's relevant summaries and customer details through WhatsApp. They cannot browse unrelated platform customers or other businesses' conversations.

### 2.10 Admin UI and initial login credentials

- Use **Ant Design (`antd`)** for the Admin Dashboard's UI, including login, account settings, forms, tables, navigation, filters, and feedback states.
- Use **SWR** for browser-side Admin Dashboard API reads and mutations, with shared typed fetchers, stable cache keys, explicit loading/error/empty states, and targeted cache invalidation after writes.
- The Admin Dashboard remains English, including component labels, validation, date-picker controls, and chart labels. This does not introduce a frontend i18n framework.
- Supply the first administrator's login identifier and initial password through environment configuration. The implementation default uses an email address as the login identifier for Supabase Auth.
- After logging in, the administrator can change their password from the dashboard's account settings.
- Password changes take effect in Supabase Auth and survive application restarts and redeployments.
- Environment credentials initialize the account once. They must not act as a permanent login fallback or overwrite a password changed in the dashboard.
- A first-login password change is available but not mandatory.
- The administrator account is separate from salon-owner WhatsApp identities and permissions.

## 3. Proposed implementation defaults

These are documented starting choices, not additional user-confirmed business requirements. Keep them easy to revise without redesigning the application.

| Item                                 | Proposed initial choice                                                                                                                                  | Implementation note                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Default timezone                     | `Europe/Berlin`                                                                                                                                          | Admin can override per salon. This does not restrict launch geography to Germany.                                                               |
| Default opening hours                | 09:00–18:00 every day                                                                                                                                    | Placeholder defaults; support weekly schedules and closed days. Admin can edit them.                                                            |
| Suggested start-time interval        | 30 minutes                                                                                                                                               | A presentation convenience, not a requirement that typed times match the grid.                                                                  |
| Out-of-hours requests                | Explain the configured hours and clarify once; accept a deliberate future-time request                                                                   | Keeps booking flexible. Record the chosen exact time; never silently move it. Isolate this policy so it can be changed explicitly later.        |
| Default technician selection setting | Disabled                                                                                                                                                 | Avoids an extra customer step until an owner wants it.                                                                                          |
| Automatic technician assignment      | Active, same-salon, not declared off; prefer the fewest bookings that day, with a deterministic tie-break                                                | A suggestion heuristic, not capacity enforcement. There is no duration-based definition of busy. Same-time assignments are permitted.           |
| Existing assignments after time off  | Leave booking/assignment intact and show the recorded off date to the owner                                                                              | No automatic cancellation or reassignment. Customer notification is not required for an unchanged booking.                                      |
| Daily quota boundary                 | Platform-configured timezone, initially `Europe/Berlin`                                                                                                  | Per WhatsApp identity across salons; changing salons must not reset usage.                                                                      |
| Quota accounting                     | Reserve once per preview request; consume if at least one preview is uploaded to WhatsApp and its media ID is recorded; release if none reach that state | Retries share the reservation. Further variants beyond the request's maximum need a new reservation. Delivery retries reuse the recorded media. |
| Draft expiry                         | 24 hours of inactivity                                                                                                                                   | Expired drafts are not bookings. Start a fresh draft without silently reusing salon selection.                                                  |
| Raw text conversation retention      | 90 days                                                                                                                                                  | Apply a documented deletion policy to summaries and stored tool context as well. Keep transaction records separately.                           |
| Operational log retention            | 30 days                                                                                                                                                  | Use metadata and redacted identifiers; no message bodies or image bytes by default.                                                             |
| Usage-report period basis            | Booking creation time, using a business reporting timezone inherited from platform defaults                                                              | Offer appointment-date views separately and label the date basis.                                                                               |
| Admin authentication                 | Supabase Auth with the initial `admin@gmail.com` / `Pass1234` account created by the first migration                                                     | No public admin registration. The UI requires an immediate password change; subsequent passwords remain in Auth. See section 5.4.               |
| Admin chart library                  | Ant Design Charts (`@ant-design/charts`)                                                                                                                 | Recommended single chart library for time-series, status, and customer-retention analytics; use shared theme tokens with Ant Design.            |
| Frontend API state                   | SWR                                                                                                                                                      | Use for client-side dashboard reads and mutations. Server Components, webhooks, jobs, and server-to-provider calls do not route through SWR.    |
| Package manager                      | pnpm                                                                                                                                                     | Pin its version in the repository.                                                                                                              |
| Code formatting                      | Prettier plus `.editorconfig`                                                                                                                            | Check formatting in CI. Keep configuration compatible with WebStorm's automatic Prettier and EditorConfig support.                              |
| Framework/runtime                    | Current stable Next.js App Router, TypeScript, supported Node.js LTS                                                                                     | Select compatible versions at implementation and commit a lockfile.                                                                             |
| Durable jobs                         | Inngest with Next.js/Vercel handlers                                                                                                                     | A proposed additional managed dependency. Record the choice and runtime limits in an ADR before integrating it.                                 |
| Branch/environment mapping           | `develop` → dev; `main` → prod                                                                                                                           | Vercel and Supabase Branching watch GitHub directly; GitHub Actions validates the revision.                                                     |

Do not introduce mandatory pricing, deposits, or an assumed billing currency. If optional service prices are included, make currency an explicit configuration field. Exact OpenAI model IDs must be selected against current official documentation and account availability at implementation, then pinned in environment configuration and documented.

## 4. System architecture

### 4.1 Components

- **Next.js application:** German landing page, English Ant Design Admin Dashboard, protected administrative actions, WhatsApp webhook, and worker endpoints. Recommended analytics library: Ant Design Charts.
- **Supabase:** PostgreSQL, migrations, Auth for platform administrators, transactional business operations, and row-level security. Do not use Supabase Storage for customer images.
- **WhatsApp Cloud API:** incoming messages, interactive replies, outbound text/buttons/lists, media transport, and approved notification templates.
- **OpenAI:** Responses API/function calling for conversations and an appropriate image-edit/generation API for previews.
- **Durable job runner:** asynchronous message processing, ordered conversation work, notification retries, image processing, and recovery. Proposed runner: Inngest.
- **GitHub Actions:** application quality checks plus fresh-database migration/RLS validation; it does not deploy the providers.
- **Vercel Git integration:** deploy the Next.js application and compatible worker handlers, with separate dev/prod configuration.
- **Supabase Branching GitHub integration:** validate preview branches and apply new production migrations after merge when production deployment is enabled.

### 4.2 Dependency boundaries

```text
WhatsApp webhook / Admin UI
            |
            v
Application services and authenticated execution context
            |
            v
Domain rules + repositories + transactional operations
            |
            +--> Supabase
            +--> WhatsApp adapter
            +--> OpenAI adapter
            +--> Durable-job adapter
```

- Routes and server actions should validate/authenticate, call application services, and format responses.
- Keep booking policies, permissions, analytics definitions, quota logic, and conversation state separate from provider SDK calls.
- Use the same application service for an operation whether requested through an admin action or an AI tool.
- Give the AI narrowly defined tools. Never expose SQL execution, generic database writes, secrets, arbitrary HTTP requests, or arbitrary business IDs as trusted authority.
- Build trusted actor/role/business context from authentication and verified WhatsApp identity on the server. Revalidate permissions on every tool invocation.
- Tool results should be small structured records with success/failure and actual persisted IDs. Free-form model text is not evidence an operation occurred.

### 4.3 Proposed repository structure

```text
AGENTS.md
README.md
DEVELOPMENT_PLAN.md
.env.example
package.json
pnpm-lock.yaml
.github/workflows/
  ci.yml
  deploy-dev.yml
  deploy-prod.yml
src/
  app/
    (marketing)/                 # German public routes
    admin/                       # English Ant Design login, protected dashboard/account routes
    api/whatsapp/webhook/         # verification and event ingestion
    api/inngest/                 # authenticated durable-worker endpoint
    api/health/                  # minimal public / protected detailed health
  components/
    admin/                       # Ant Design providers, reusable forms/tables/chart wrappers
    marketing/
  features/
    businesses/
    salons/
    services/
    technicians/
    customers/
    bookings/
    conversations/
    previews/
    analytics/
  lib/
    auth/
    config/
    db/
    bot/i18n/                    # en/de dictionaries; bot only
    observability/
  integrations/
    whatsapp/
    openai/
    jobs/
  jobs/
  generated/database.types.ts
supabase/
  config.toml
  migrations/
  tests/
tests/
  unit/
  integration/
  e2e/
  fixtures/                      # synthetic text/webhook fixtures; no real customer media
scripts/
  whatsapp-simulator.ts          # signed local webhook input helper
docs/
  index.md
  implementation-status.md
  product/
  architecture/
  development/
  integrations/
  operations/
  adr/
```

Keep feature modules small. A module can contain its schemas, services, repositories, permissions, and presentation code as needed; do not create empty layers just to match a template. Record actual paths in documentation once implemented.

### 4.4 Admin UI and chart conventions

- Use Ant Design's layout, menu, form, input, table, date-picker, statistic, modal/drawer, and feedback components consistently. Centralize design tokens and reusable patterns rather than creating competing component systems.
- Integrate Ant Design with the Next.js App Router using the supported `@ant-design/nextjs-registry` pattern for first-render styles. Keep providers and client boundaries appropriate to the installed versions.
- Configure Ant Design's English locale explicitly in the admin layout. The public German landing page keeps its own fixed-language layout and does not inherit admin labels or locale settings.
- Use **Ant Design Charts (`@ant-design/charts`)** as the recommended chart library: line/area charts for trends and column/bar charts for status and business/salon comparisons. Do not add a second chart library for the same requirements.
- Place charts behind client-component boundaries and use lazy loading where appropriate. Keep database reads, authorization, and metric calculations on the server.
- Centralize SWR configuration, typed API fetchers, cache keys, and mutation error mapping. Do not scatter ad hoc `useEffect` fetches through dashboard components.
- Define shared chart colors, typography, number/date formatting, legends, and tooltips from the admin theme. Show period, timezone, scope, and metric definitions clearly.
- Every chart needs loading, empty, and error states plus an accessible textual/table equivalent. Filters and CSV exports must use the same metric/query definitions as the visible chart.
- Add an English account-settings screen with password-change feedback. Keep the login route publicly reachable while protecting dashboard pages and all account mutations.
- Document these patterns in `docs/development/admin-ui.md` so future agents extend the established UI and chart conventions.

## 5. Data model and isolation

### 5.1 Logical entities

The coding agent should turn these logical entities into an ER diagram and reviewed migration design before implementing the data layer.

| Entity                               | Responsibilities and important fields                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `platform_settings`                  | Default timezone/hours/interval, quota defaults, localized greetings; excludes a runtime bot-language override.                                                                                                                            |
| `platform_admins`                    | Explicitly permitted Supabase Auth users and the UI-only `must_change_password` state.                                                                                                                                                     |
| `businesses`                         | Owner's business group, reporting timezone, active state.                                                                                                                                                                                  |
| `salons`                             | Business ID, name, location/address, optional search coordinates, timezone, weekly opening hours, suggested interval, active state, technician-selection setting.                                                                          |
| `contacts`                           | Platform WhatsApp identity, normalized contact number when available, observed display name, first/last contact timestamps.                                                                                                                |
| `business_owners`                    | Business-to-contact/WhatsApp identity ownership mapping; supports multiple owners and multiple businesses per identity.                                                                                                                    |
| `services`                           | Salon-scoped catalog, active/deleted state, optional description, display ordering, optional informational duration/price.                                                                                                                 |
| `technicians`                        | Salon/business scope, WhatsApp identity, display name, active/deleted state. Initial implementation may use one staff record per salon for the same person.                                                                                |
| `technician_time_off`                | Technician and salon scope, local dates or ranges, optional note.                                                                                                                                                                          |
| `business_customers`                 | Relationship between a contact and businesses with which they have interacted/booked; no copying of unrelated business data.                                                                                                               |
| `bookings`                           | Business/salon/customer, requested UTC start, original local time/timezone snapshot, confirmed/cancelled status, nullable/unconstrained technician reference, display snapshots, optional request, cancellation metadata, idempotency key. |
| `booking_services`                   | Zero or more catalog or `Other` items; preserve labels/details even after catalog deletion.                                                                                                                                                |
| `booking_events`                     | Creation/cancellation history and actor/source for reliable reporting and debugging.                                                                                                                                                       |
| `conversations`                      | WhatsApp identity, active role/business context, greeting state, bounded summary, last activity.                                                                                                                                           |
| `conversation_messages`              | Sanitized inbound/outbound text, message type, WhatsApp IDs, timestamps, contextual scope, expiry. Never store media bytes or raw base64.                                                                                                  |
| `booking_drafts`                     | Selected salon, services, technician preference, parsed date/time, missing fields, revision, expiry.                                                                                                                                       |
| `interactive_prompts`                | Prompt/message ID, valid option IDs, purpose, scoped entity references, draft revision, expiry.                                                                                                                                            |
| `tool_executions`                    | Tool name, sanitized arguments/results, actor, idempotency key, state, correlation IDs.                                                                                                                                                    |
| `webhook_inbox`                      | Deduplicated normalized inbound events, routing identifiers, processing state, attempts.                                                                                                                                                   |
| `job_outbox`                         | Durable intent to dispatch background jobs, dispatch/retry state.                                                                                                                                                                          |
| `message_outbox`                     | Outbound text/control/template requests, recipients, delivery state and WhatsApp IDs; image items contain media IDs only.                                                                                                                  |
| `preview_requests` / `preview_usage` | Source WhatsApp media ID, daily quota reservation, bounded output media IDs, generation/delivery state, counts and failure codes.                                                                                                          |
| `audit_events`                       | Admin/owner configuration mutations and operational actions, without sensitive raw payload dumps.                                                                                                                                          |

Combine tables only where that simplifies the actual implementation without losing transactional guarantees or clarity. Document any divergence from this logical model.

### 5.2 Data integrity rules

- Use proper foreign keys and business/salon consistency checks for required internal relationships.
- The deliberate exception is the optional booking technician reference. Do not add a strict FK later without an explicit product change.
- Resolve technician references using the booking's business and salon scope, not by global ID alone.
- Preserve booking snapshots when services/technicians are deleted or renamed. Prefer soft deletion for catalog records.
- Store instants in UTC and relevant IANA timezone information. Off dates are local calendar dates.
- An empty service list and an empty additional request are valid when services have not been configured. Technician absence is always valid.
- Create/cancel operations, quota reservations, and outbox insertion need transactions and unique idempotency keys.
- Check cancellation permission and the actual current instant inside the transaction. Do not rely on the time when an AI response started.
- Add indexes for business/salon/date reports, customer history, technician booking lookup, message deduplication, active jobs, and quota identity/day keys.
- Use a timezone-aware library and test daylight-saving transitions. Do not resolve dates with the server's implicit timezone.

### 5.3 Authorization boundaries

- Enable RLS and restrict direct access to private tables.
- Treat a server-side Supabase service key as privileged: it bypasses normal RLS, so application-level actor/scope checks remain mandatory.
- Derive owner/technician identity from a signature-verified WhatsApp event and stored memberships, never from a user's text claim.
- Customers can access only their own bookings. Technicians can access only bookings whose valid assignments belong to them in the relevant scope.
- Owners can see customer information related to their business; a global contact ID does not grant access to that person's other salon history.
- Admin protection must cover pages, server actions, API handlers, reports, and exports, not only navigation or middleware.
- Keep different role/business contexts separate when constructing AI input. Permission changes invalidate previously authorized draft/tool context.

### 5.4 Initial administrator and password lifecycle

Use Supabase Auth as the credential store. Do not put a password in `platform_settings` or `platform_admins`.

Initial provisioning:

1. The initial schema migration inserts the confirmed Supabase Auth account `admin@gmail.com` with password `Pass1234`, adds `platform_admins` membership, and sets `must_change_password=true`.
2. Do not add admin email/password environment variables or a public setup endpoint.
3. The migration is the only place that applies the initial credential. Normal pushes apply only new migration files, so a later password is never reset on redeploy.
4. A fresh local reset and a fresh production database deliberately create the same administrator and otherwise contain no salon/customer sample data.

Normal login and password changes:

- Authenticate against Supabase Auth's stored credentials and require explicit platform-admin membership before granting dashboard access.
- When `must_change_password` is true, the protected shell redirects to Account settings and disables other dashboard navigation. This is a UI/UX guard; APIs keep their normal authenticated-admin checks and do not add a separate first-password guard.
- The account-settings form collects the current password, new password, and confirmation and applies the configured Auth password policy through the supported authenticated update flow. A successful update clears `must_change_password`.
- Derive the target user from the verified session, not a client-supplied user ID. Protect the mutation against unauthenticated/cross-account requests and document the selected session-revocation behavior.
- Persist the changed password through Auth. After logout, the old password must fail and the new password must work.
- Never log submitted current/new passwords or include them in audit payloads, fixtures, job checkpoints, or generated runtime output. Audit only the action and actor.
- Document an explicit protected Supabase Auth recovery procedure for a forgotten password in the operations runbook.

## 6. WhatsApp and conversation processing

### 6.1 Reliable inbound processing

1. Implement Meta's webhook verification endpoint.
2. Verify POST signatures against the raw request body and validate the expected business phone-number identity.
3. Distinguish user messages, interactive selections, and delivery/status updates. Do not send delivery receipts to the AI as user messages.
4. Normalize and persist the necessary event fields. For media, retain IDs/type and safe metadata only.
5. Transactionally record a unique inbox event and a job-dispatch intent.
6. Acknowledge after durable acceptance. Do not wait for AI or image generation. If durable acceptance fails, allow the webhook to be retried instead of returning a false success.
7. Dispatch through the durable runner; recover undispatched intents with a scheduled reconciler.
8. Serialize state-changing work per WhatsApp conversation and use draft revisions to prevent concurrent messages from corrupting a draft.
9. Persist outgoing message intent before delivery and track provider responses/status updates.

Keep serialized state transitions short. Image generation runs in a separate job and must not hold the conversation lock while the customer continues chatting or booking. Apply late job results to their originating request ID, not whichever draft happens to be active when they finish.

Do not use process memory, an unawaited promise, or a long-running webhook request as the durable job system. Vercel restarts, retries, and deployments must not lose booking state.

### 6.2 Building AI context

Use Supabase as the source of conversation and booking state. For each model call provide:

- Bot instructions and fixed locale.
- Trusted actor/mode and permitted business context.
- Relevant recent text messages and a bounded summary of older applicable context.
- The structured draft and its revision.
- The current salon timezone and absolute local date/time; anchor relative expressions to the customer's message timestamp when processing is delayed.
- Actual relevant tool results and narrowly scoped available tools.

Preserve function-call/result associations and other replayable response items required by the selected API. Do not replay image content into persistent text history. Prefer app-managed Responses API history with response storage disabled; document that this setting does not itself remove all provider-side retention.

Keep all business state reconstructible from the database. Model output, conversation summaries, and text such as `I booked it` must never substitute for querying the booking record.

### 6.3 Tool groups

| Context            | Example tools                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer discovery | `search_salons`, `get_salon_details`, `list_services`, `list_technicians`                                                                                           |
| Customer booking   | `update_booking_draft`, `create_booking`, `list_my_bookings`, `get_my_booking`, `cancel_my_booking`                                                                 |
| Customer styles    | `get_preview_quota`, `request_style_previews`                                                                                                                       |
| Owner              | `list_my_salons`, `update_salon`, `create_service`, `update_service`, `deactivate_service`, technician management, booking/customer summaries, availability queries |
| Technician         | `list_assigned_bookings`, `get_assigned_booking`, `submit_time_off`, `remove_time_off`                                                                              |

Tool schemas must be explicit and validated. The application provides trusted identity/scope separately from model-generated arguments. A model may suggest identifiers, but the tool implementation resolves and authorizes them.

Map text and interactive replies into the same draft operations. Store prompt IDs so a tap on an older menu does not accidentally apply to a different salon, role, or booking draft. Revalidate live entities when a stored choice is used.

Clarify nonexistent local dates/times, ambiguous expressions such as `Friday afternoon`, multiple same-name salons, and daylight-saving ambiguities. Do not silently invent a time or create a booking from a general question about availability.

### 6.4 Notifications

- Notify a valid assigned technician when a booking is created or cancelled.
- Missing/deleted technicians and unavailable recipients must not cause booking operations to fail.
- Handle every recipient's own WhatsApp customer-service window. A customer's inbound message does not open a technician's messaging window.
- Provision approved templates in supported languages for notifications that require templates and the applicable opt-in process. Select the template language from the fixed deployment locale.
- Track attempts, delivery failures, and suppressed notifications in operations data. Do not report delivery as successful before the provider accepts it.
- Retry transient failures with bounded backoff. Handle uncertain provider outcomes explicitly; do not promise exactly-once external delivery.
- Do not retry booking creation merely because its notification failed.

## 7. Image-preview pipeline

Validate this pipeline early because it combines provider latency, serverless execution limits, and the no-persistent-images requirement.

1. Identify the source WhatsApp media ID and the customer's request.
2. Check and atomically reserve the customer's platform-wide daily quota using a unique preview-request ID.
3. Persist metadata and enqueue work containing only IDs and text instructions.
4. Download source media into a bounded in-memory buffer/stream. Validate supported type and size; do not log media content or signed download URLs.
5. Call the selected OpenAI image-edit/generation capability to produce distinct nail-style previews.
6. Keep resulting bytes in memory and upload them directly to WhatsApp media storage.
7. Persist only the resulting WhatsApp media IDs and generation metadata, then deliver the images/captions through the message outbox.
8. Finish quota accounting and persist a concise text summary of the requested styles.
9. Release memory and handle failure/retry states without persisting image files.

Important implementation constraints:

- If a job runner persists step inputs/results, the download → generation → WhatsApp upload portion must not checkpoint image bytes. Its durable outputs are metadata/media IDs only.
- Do not return a base64 provider response from a durable step or attach it to logs/error reports.
- Generate/upload individual previews in bounded work units when appropriate. Check actual Vercel plan limits and the chosen model's latency before setting timeouts and concurrency.
- Durable retries do not extend a single serverless invocation indefinitely. If the selected runtime cannot support the in-memory operation, resolve the worker design in an ADR; do not quietly add image storage.
- On partial success, deliver available previews and count one request. On zero previews with recorded WhatsApp media IDs, release the reservation after resolving in-flight/uncertain work according to the documented policy.
- Retry delivery using saved WhatsApp media IDs. Do not regenerate an image just because its message delivery needs retrying.
- A crash between external generation/upload and local recording can have an uncertain outcome. Reconcile what can be identified; avoid blind repeated paid generation and record the ambiguity.
- Confirm account access/model support using a controlled dev smoke test. Paid external API tests must not run automatically on every PR.

## 8. Analytics definitions

Create `docs/product/analytics.md` before implementing charts. It must define every metric, scope, period basis, timezone, and cancellation treatment.

Initial definitions:

- **Total created bookings:** bookings created in the selected creation-time cohort.
- **Confirmed bookings:** records in that same cohort whose current status is `confirmed`.
- **Cancelled bookings:** records in that same cohort whose current status is `cancelled`.
- For that cohort, `total created = confirmed + cancelled`. Historical reports can change after a later cancellation; show the report's generated-at timestamp.
- **Cancellation events in a period:** a separate measure using `cancelled_at`; never mix it into a creation-time cohort without labeling it.
- **Unique booking customers:** distinct WhatsApp contacts with bookings in the selected cohort/scope.
- **Returning booking customers:** customers booking in the period who had an earlier booking in the same business/salon scope. Clearly label whether an accompanying chart filters out cancelled bookings.
- **Repeat-customer rate:** returning booking customers divided by unique booking customers in the period; return zero or an explicit empty state for an empty denominator.
- **New booking customers:** customers whose first booking in the selected scope occurs in the period.

Support both business and salon scopes. A business's unique-customer count is a distinct count across its salons, not the sum of salon counts. Multiple services in one appointment count as one booking.

Monthly reports should include business identity, period/timezone/date basis, per-salon breakdown, total/currently confirmed/cancelled bookings, unique customers, and returning-customer metrics. Provide CSV export. Prices, charges, invoice generation, and actual-visit metrics must not be inferred.

## 9. Environments, migrations, and CI/CD

### 9.1 Environment isolation

| Environment | Application                             | Database                              | External services                                                                       |
| ----------- | --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Local       | Local Next.js and local job runner      | Supabase CLI local stack              | Fixtures/mocks by default; a dedicated test number/tunnel for intentional live checks.  |
| Dev         | Dedicated Vercel dev project/deployment | Dedicated Supabase dev project        | Test WhatsApp number/app configuration and isolated OpenAI/job credentials or projects. |
| Prod        | Dedicated Vercel production project     | Dedicated Supabase production project | The one shared public WhatsApp number and production provider configuration.            |

One shared number means one customer-facing number for all production salons; it does not mean local/dev must share production's webhook or customers.

Never point PR previews at production write credentials or the production WhatsApp callback. Keep local/dev business data empty by default and use test-scoped fixtures where validation needs records; do not copy production conversations into development.

### 9.2 Configuration contract

Document exact variables in `.env.example` and `docs/development/configuration.md`. Proposed groups:

- Application environment and public URL.
- Supabase URL, public/publishable key where needed, and server-only privileged credentials.
- WhatsApp phone-number ID, business account ID, access token, app secret, webhook verification token, and approved template mappings.
- OpenAI API key, chat model, image model, and bounded request settings.
- Job-runner signing/event keys and environment identity.
- `BOT_LOCALE`, validated to `en` or `de` and fixed for the deployment.
- Operational fallback defaults for platform timezone, hours, interval, and preview limits; live values are managed in the Admin Dashboard where specified.

Bot locale must not be read from a runtime-editable settings table, browser preference, cookie, request header, or AI language detection. Editing a greeting's content is independent of selecting the deployed bot language.

Keep secrets server-only. Do not prefix privileged credentials with `NEXT_PUBLIC_`, expose them to the model, or place them in logs or generated documentation.

The initial admin credential is fixed in the initial migration and is not an environment variable. Supabase Auth owns every later password; ordinary redeployment does not rerun an applied migration or reset it.

### 9.3 Migration strategy

- Every schema, function, index, permission, and RLS change is a versioned SQL migration under `supabase/migrations/`.
- The initial migration creates the required Auth administrator and platform settings. No `supabase/seed.sql` is used.
- Local development can reset its disposable database and apply the full migration history to the same empty-business-data state as production.
- CI must validate migrations against a fresh local database and meaningful upgrade cases when existing data is affected.
- Generate TypeScript database types from the schema and fail checks for stale generated types.
- Never edit an already applied migration. Add a new migration.
- Do not use remote database reset commands in dev/prod deployment pipelines.
- Use backward-compatible expand/migrate/contract changes because old and new Vercel deployments and background jobs may overlap.
- Avoid direct production dashboard schema edits. If an operational repair is unavoidable, capture it in a reconciled migration and incident note.

### 9.4 GitHub integration and validation

**GitHub Actions:** install from the lockfile, check formatting, lint, typecheck, run relevant unit/integration tests, validate migrations/RLS against a fresh local Supabase stack, and build the app. Use fixtures for external providers.

**Vercel Git integration:** deploy connected branches and production `main` automatically. No Vercel deployment workflow or Vercel token is needed in GitHub Actions.

**Supabase Branching GitHub integration:** use working directory `.`, validate branch migrations, and enable **Deploy to production** for `main`. New versioned migrations then apply on Supabase's side without a custom GitHub migration workflow.

- Require the Quality and Supabase integration checks before merge.
- Vercel and Supabase respond independently to Git changes, so every schema change must remain compatible with the previous and next application revisions.
- Builds must not require live production business data.
- Record commit SHA, migration version, environment, bot locale, and provider deployment result.
- Roll application code back only to a version compatible with the current schema. Database recovery is a documented forward repair or restore operation, not a blind reverse migration.
- Document required provider accounts, secrets, callback URLs, database backups, and restore capabilities. Account configuration is a deployment prerequisite, not mandatory work for salon owners.

## 10. Documentation required during coding

Documentation is part of each phase's deliverable. Do not defer all documentation until the application is finished.

### 10.1 Required documents

| File                                      | Must explain                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                               | Short entry point for coding agents: reading order, exact commands, module map, key product invariants, authorization boundaries, documentation-update rules, and prohibited storage patterns.       |
| `README.md`                               | Product overview, current implementation state, quickstart, configuration prerequisites, and links to docs.                                                                                          |
| `docs/index.md`                           | Navigation by task: setup, change a feature, understand data, debug a message, deploy, investigate an incident.                                                                                      |
| `docs/implementation-status.md`           | Phases completed/in progress, real validation results, known limitations, and next actionable work. Clearly distinguish planned from implemented.                                                    |
| `docs/product/requirements.md`            | Current agreed requirements with stable IDs and traceability to implementation/acceptance scenarios.                                                                                                 |
| `docs/product/conversation-flows.md`      | Customer/owner/technician examples, greetings, natural text and button paths, ambiguity handling, optional setup, and cancellation behavior.                                                         |
| `docs/product/analytics.md`               | Metric definitions and worked examples including repeat customers, cancellations, and monthly cohorts.                                                                                               |
| `docs/architecture/overview.md`           | Components, request/job flows, dependency boundaries, and where to add common features.                                                                                                              |
| `docs/architecture/data-model.md`         | ER diagram, ownership/tenancy, indexes, snapshots, technician-reference exception, retention, and generated-type workflow.                                                                           |
| `docs/architecture/authorization.md`      | Actor resolution, migration-created admin/password lifecycle, RLS/service-key responsibilities, tool scoping, and cross-business isolation.                                                          |
| `docs/architecture/conversation-state.md` | Draft lifecycle, context building, summary retention, ordered processing, stale buttons, idempotency, and recovery.                                                                                  |
| `docs/integrations/whatsapp.md`           | Webhook verification/signatures, normalized payload examples, buttons/lists, recipient windows/templates, media handling, delivery states, and local testing.                                        |
| `docs/integrations/openai.md`             | Selected models, tool schemas, prompt ownership/versioning, context replay, locale rules, preview generation, provider retention distinction, and cost/latency observations.                         |
| `docs/development/local-setup.md`         | Tested setup instructions, including Windows/PowerShell, WebStorm formatting, and local Supabase prerequisites.                                                                                      |
| `docs/development/configuration.md`       | Every environment variable and dashboard setting, defaults, secrets, scope, and whether changes require redeploy.                                                                                    |
| `docs/development/admin-ui.md`            | Ant Design/Next.js setup, theme and English locale, reusable form/table patterns, SWR data/mutation conventions, Ant Design Charts usage, accessibility, and login/account-settings UX.              |
| `docs/development/testing.md`             | Exact commands, fixtures, database/RLS tests, conversational evaluation cases, and intentional live-provider tests.                                                                                  |
| `docs/development/feature-workflow.md`    | Step-by-step change guides for adding a tool, setting, catalog field, booking behavior, notification, and metric.                                                                                    |
| `docs/operations/deployment.md`           | Branch/environment mapping, CI/CD ordering, migrations, release verification, and rollback.                                                                                                          |
| `docs/operations/runbooks.md`             | Webhook failure, delayed jobs, duplicate events, failed notifications, unavailable images, quota reconciliation, AI errors, database recovery, initial-admin login, and protected password recovery. |
| `docs/adr/NNNN-title.md`                  | Significant decisions, status, context, chosen approach, alternatives, consequences, and affected modules.                                                                                           |

Create documents when their area first appears. It is acceptable for an early document to be short and explicitly mark unimplemented sections; it is not acceptable to claim planned endpoints, commands, or tests already work.

### 10.2 Required initial ADRs

1. Shared WhatsApp number, business isolation, and role/identity model.
2. Durable job runner and Vercel execution constraints.
3. Flexible bookings and the intentionally unconstrained technician reference.
4. App-owned conversation history and OpenAI tool execution.
5. No persistent image storage and the in-memory preview pipeline.
6. Fixed bot locale per deployment with fixed-language frontend surfaces.
7. Migration/deployment ordering and backward compatibility.
8. Ant Design Admin Dashboard and Ant Design Charts integration.
9. Migration-created initial admin with a required first password change and Auth-owned subsequent passwords.

An ADR records a decision; it is not a new approval ceremony. Resolve routine implementation choices within the user's authorized scope and record the reasoning. Revisit a decision when evidence or user requirements change.

### 10.3 Documentation change rules

- A feature change updates the relevant product rule, module map, flow, configuration contract, and tests where affected.
- A database change includes a migration, updated generated types, and data-model documentation.
- A new/changed AI tool includes schema, permissions, side effects, idempotency behavior, failure behavior, and examples.
- A prompt change includes its intended behavior change and updates relevant evaluation cases. Keep prompts version-controlled.
- A metric change updates its formula, date basis, examples, and export labels together.
- A job or integration change updates retries, timeout limits, operational signals, and the recovery runbook.
- A new environment variable updates `.env.example`, validation, CI/deployment configuration, and the configuration guide.
- A change to admin UI/authentication updates the relevant component patterns, account lifecycle, first-login/recovery instructions, and meaningful acceptance checks.
- Keep one authoritative location for each fact and link to it. Avoid copying the entire plan into every document.
- Check links and commands. Use Mermaid for small architecture/ER/sequence diagrams when it improves understanding.
- Do not put credentials, customer conversation dumps, real phone numbers, or image data in docs and fixtures.

### 10.4 Suggested coding-agent workflow

1. Read `AGENTS.md`, the implementation status, the relevant product rules, and affected ADRs.
2. Inspect current code and repository state. Preserve unrelated user changes.
3. Identify the smallest complete authorized feature slice and its affected modules, data, tools, docs, and tests.
4. Implement through existing application services rather than duplicating rules in UI, webhooks, and prompts.
5. Add migrations only when necessary and update generated types.
6. Validate meaningful behavior and failure paths, using mocks for routine provider calls.
7. Update documentation in the same change and mark implementation status honestly.
8. Report what changed, how it was verified, and any actual limitations or unverified external prerequisites.

Do not require a new confirmation for every routine step of already authorized coding. Ask only when a materially unresolved requirement or required external access prevents progress; continue independent work where possible.

## 11. Implementation phases

### Phase 0 — Repository and agent documentation foundation

Deliverables:

- Establish the GitHub-ready repository, ignore rules, README, root `AGENTS.md`, docs index, and implementation tracker.
- Create current product requirements with stable IDs, preserving this plan as the planning artifact.
- Record initial assumptions and the first architecture ADRs.
- Define coding conventions and the intended package scripts, marking commands as planned until implemented.

Acceptance: a new coding agent can identify the product's flexible booking rules, all role interfaces, the implementation status, and the next phase without rereading the chat conversation.

### Phase 1 — Application scaffold, authentication, and deployment skeleton

Deliverables:

- Next.js/TypeScript/pnpm scaffold, environment validation, Node runtime choices, Prettier/EditorConfig for WebStorm, and format/lint/typecheck/test/build scripts.
- Dummy German landing page with WhatsApp link and an English Ant Design login/protected admin shell, with appropriate Next.js style registration, theme providers, and shared SWR configuration.
- Supabase local stack and migrations for admin authorization, including the fixed initial Auth account and first-password-change flag.
- Admin account settings for authenticated password changes, with documented reauthentication/session behavior and no password reset on redeployment.
- Bot-only en/de dictionary loader and deployment-fixed locale configuration.
- GitHub quality CI plus provider-native Vercel and Supabase GitHub deployment configuration.
- Durable-runner integration spike and an image-processing feasibility design covering memory, payload capture, invocation limits, and retries.

Documentation: local setup, configuration, architecture overview, authorization/password lifecycle, admin UI conventions, deployment, durable-jobs ADR, image-storage ADR, and admin-UI/authentication ADRs.

Acceptance: local app and database run from documented instructions; the migration-created initial admin can log in and is routed to change its password; the new password survives redeployment while the initial password fails; unauthorized admin access fails; a clean database rebuild works; CI checks pass; Ant Design renders without hydration/style errors and frontend languages are fixed correctly; the worker approach can satisfy the no-image-storage constraint.

### Phase 2 — Business data and Admin Dashboard setup

Deliverables:

- Business/salon/owner/customer/catalog/technician schema, RLS and permissions, and generated types. Business data remains empty until entered through the product or test-scoped fixtures.
- Ant Design forms/tables for admin CRUD of businesses/salons, services, and technicians; owner assignment; active states; default hours/timezone/interval; bot greeting and preview-quota settings.
- Minimal salon creation requiring name/location and owner assignment while keeping services and technicians optional.
- Audit trail for configuration changes and a protected settings interface that cannot change active bot locale.

Documentation: data model/ER diagram, setup requirements, setting descriptions, technician-reference ADR.

Acceptance: admin can create a bookable salon with no services/staff; multiple owners and salons can share a business; cross-business access tests pass; deleting catalog records preserves transaction history behavior.

### Phase 3 — WhatsApp transport, durable processing, and conversation memory

Deliverables:

- Verification/signature checks, normalized webhook handling, inbox/outbox tables, job dispatch recovery, and per-conversation ordering.
- Contacts, text history, greeting state, summaries, draft storage, and interactive-prompt mapping.
- WhatsApp text/button/list senders, delivery tracking, and a simple local simulator using synthetic payloads.
- Dashboard-configured greeting with duplicate-event protection.

Documentation: WhatsApp integration, conversation-state lifecycle, transport diagrams, operational retry/recovery procedures.

Acceptance: duplicate/reordered events do not duplicate greetings or corrupt drafts; status callbacks do not trigger chat replies; conversations survive process restart/deployment; media events persist identifiers only; greeting wording follows `BOT_LOCALE`.

### Phase 4 — Customer conversational booking

Deliverables:

- OpenAI Responses API integration with validated function calling and app-owned conversation context.
- Global salon search/selection, service/Other selection, optional requests, technician preferences, natural date/time interpretation, booking creation, booking lookup, and cancellation.
- Optional buttons/lists sharing the same state transitions as typed responses.
- Transactions, idempotent actions, exact booking confirmations, and graceful missing-technician behavior.

Documentation: OpenAI integration, tool catalog, customer conversation examples, booking policies, date/time interpretation.

Acceptance: customer can complete a booking entirely by typing, entirely with available controls, or by mixing both. Booking works with no catalog/staff. Multi-service bookings remain one appointment. Replayed tool calls create one booking. A valid future booking is not rejected for capacity, duration, or missing technician. Customer cancellation uses the agreed start-time cutoff.

### Phase 5 — Owner and technician WhatsApp operations

Deliverables:

- Identity/role-context resolution and business selection for people with multiple memberships.
- Owner tools for salon updates, catalog/staff maintenance, technician-selection configuration, customer details, booking views, and daily/weekly summaries.
- Technician tools for assigned bookings and optional time off.
- Technician booking/cancellation notifications with template mapping and recipient-window handling.

Documentation: owner/technician conversation flows, role/tool permissions, notification templates, time-off behavior and recovery.

Acceptance: owners and technicians perform their functions without web accounts or mandatory onboarding. Technicians cannot query other staff's bookings. Declared leave affects suggestions but does not cancel bookings. Missing/unreachable technicians do not break booking or cancellation.

### Phase 6 — AI style previews

Deliverables:

- Photo-message handling, style request clarification, atomic platform-wide quota reservations, and asynchronous previews.
- In-memory source processing/generation/WhatsApp upload, short captions, usage feedback, partial-failure handling, and quota reconciliation.
- Admin visibility into request counts, failure states, latency, and configured limits without stored image content.

Documentation: actual selected model/settings, image data-flow diagram, quota examples, checkpoint/logging constraints, failure runbook.

Acceptance: default limits enforce 3 requests/day across salons and at most 3 previews/request, including concurrent events and retries. No image bytes are written to storage/logs/job checkpoints. Delivery retries reuse WhatsApp media IDs. A controlled dev smoke test demonstrates actual preview delivery when provider credentials are available.

### Phase 7 — Analytics and platform operations dashboard

Deliverables:

- Ant Design Charts for confirmed/cancelled/total trends, unique/new/returning customers, and repeat-booking comparisons, with Ant Design salon/business/period filters, clear date-basis labels, tabular alternatives, and CSV monthly reports.
- Business-level aggregation across multiple owners/salons without double-counting unique customers.
- Health views for database availability, verified webhook activity, queue age, failed jobs, notification delivery, preview failures, and provider usage metadata.
- Owner WhatsApp summaries reuse the same metric/query definitions where applicable.

Documentation: metric definitions with sample calculations, admin-report guide, chart component/theme conventions, health signals and incident runbooks.

Acceptance: test-fixture scenarios reconcile total/currently confirmed/cancelled counts; returning customers and cross-salon distinct counts are correct; cancellations remain visible; reports do not claim actual attendance or calculate an unspecified charge.

### Phase 8 — Release readiness and maintenance handoff

Deliverables:

- End-to-end checks of customer, owner, technician, and admin paths, including both deployed bot locales.
- Recovery checks for webhook retries, worker crashes, provider timeouts, stale selections, missing entities, and migration/deployment failure.
- Retention cleanup jobs for text context and operational records; verified absence of image payload persistence.
- Tested runbooks, environment setup instructions, provider-template inventory, backup/restore procedure, and final documentation review.
- Dev release, then production deployment through the defined automatic pipeline when production provisioning is complete and deployment is within the user's authorized scope.

Acceptance: required checks pass; actual provider prerequisites and any remaining limitations are documented; a new AI agent can set up, trace a message, modify a feature, and run its relevant checks from the repository documentation.

## 12. Verification strategy

Use tests that verify meaningful rules and failure modes. Do not create large suites that only mirror trivial implementation details or snapshot every line of AI prose.

### 12.1 Domain and database scenarios

- Book with no services, no technicians, null technician, and a stale/nonexistent technician reference.
- Book multiple services plus `Other`; skip optional additional requests.
- Multiple bookings at one start time succeed without duration/capacity enforcement.
- One versus several active platform salons; a returning customer's new booking still requires selection when several exist.
- Cancel before, exactly at, and after appointment start; retry the same cancellation safely.
- Delete/rename services or technicians without breaking old bookings or reports.
- Owner/customer/technician/admin authorization, including cross-business and multi-role cases.
- Initial migration creates exactly one `admin@gmail.com` membership, a valid `Pass1234` Auth hash, and `must_change_password=true` on a fresh database.
- Successful authenticated password change clears the UI flag; reject unauthorized/cross-account changes; the old password fails afterward and the new password works after redeployment.
- Concurrent booking-tool calls, quota reservations, and duplicate webhook/job delivery.
- UTC/local time conversions, relative dates anchored to message time, daylight-saving gaps and repeated hours.
- Declared time off changes selection candidates without cancelling an existing booking.

### 12.2 Conversation evaluation cases

Use deterministic stubbed tool/model responses for routine tests and a small version-controlled scenario set for intentional live evaluations:

- `Tomorrow at 3 pm`, `Morgen um 15 Uhr`, ambiguous `Friday afternoon`, and a delayed message crossing midnight.
- Salon name/location matches, multiple same-name salons, and switching salons mid-draft.
- Multiple services in one message, no catalog, `Other`, and a skipped optional note.
- First message already includes the salon, services, and time.
- Typed responses after a list was offered; list selections after earlier typed details.
- Taps on expired prompts or prompts belonging to an old draft/salon.
- An inquiry that must not create a booking and an explicit booking request that should.
- Missing technician and failed notification after a successful booking.
- Input in another language while replies remain in fixed `BOT_LOCALE`.
- A customer claiming to be an owner or asking the model to reveal another business's records.

Assert resulting state, tool calls, permissions, and locale rather than exact conversational wording.

### 12.3 Integration and release checks

- Signature verification, minimal normalized payloads, media metadata handling, and outbound interactive-message limits.
- Outbox/reconciler recovery and crash boundaries around external actions.
- RLS plus application-service authorization tests against local Supabase.
- Migration replay and applicable upgrade compatibility, generated types, and dev/prod credential separation.
- Both locale builds; changing the dashboard greeting does not switch locale.
- Meaningful Ant Design admin login/password-change/CRUD/report end-to-end tests, first-render style/hydration checks, chart/filter consistency, empty/error states, and CSV count reconciliation.
- Inspection of databases, job payloads/checkpoints, filesystem behavior, and logging paths for accidental image persistence.
- Documentation link checks and command verification. Do not claim a live-provider smoke test ran if only fixtures were used.

## 13. Definition of done for each feature

- Agreed behavior works through the intended interface and respects the flexible booking rules.
- Authorization and business scoping apply to every entry point and AI tool involved.
- Retries and failure states are handled where the feature calls external providers or changes durable state.
- Migrations, generated types, configuration, and deployment implications are included where relevant.
- Appropriate checks pass, with any unavailable live checks explicitly recorded.
- Relevant product, architecture, integration, operational, and agent documentation is updated in the same change.
- Implementation status distinguishes completed work from placeholders and external prerequisites.
- No real customer media, secrets, or sensitive payload dumps enter the repository or application persistence.

## 14. Deferred scope

The initial plan does not include owner/technician web dashboards, automatic invoice/payment collection, customer deposits, mandatory attendance/no-show tracking, strict appointment resource scheduling, automatic image galleries, arbitrary WhatsApp-avatar lookup, runtime language switching, or a separate customer account/login portal.

Customer self-rescheduling is also deferred: the agreed customer change operation is cancellation before the start and a new booking. Add a dedicated reschedule workflow only when requested, with explicit notification and analytics behavior.

## 15. Official references and revalidation

The following sources informed this plan. Provider limits, model availability, runtime duration, and account eligibility must be rechecked when implementing the relevant integration; do not copy examples containing filesystem image writes into this application's no-storage pipeline.

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI data controls and retention](https://developers.openai.com/api/docs/guides/your-data)
- [WhatsApp reply-button messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages)
- [WhatsApp list messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages)
- [WhatsApp conversational components](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/conversational-components)
- [Supabase environment and migration management](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase server-only initial user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase authenticated password updates](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Ant Design with Next.js](https://ant.design/docs/react/use-with-next/)
- [Ant Design Charts getting started](https://ant-design-charts.antgroup.com/en/manual/getting-started)
- [Inngest serving functions and runtime considerations](https://www.inngest.com/docs/learn/serving-inngest-functions)

## 16. Starter instruction for a future coding agent

```text
Read DEVELOPMENT_PLAN.md and any existing AGENTS.md, README.md,
docs/index.md, and docs/implementation-status.md.

Implement the next unfinished phase within my requested scope. Inspect the
existing repository before changing it. Preserve the agreed flexible booking
rules, shared WhatsApp model, business isolation, fixed language behavior,
optional technician references, and no-persistent-images constraint. Use the
documented Ant Design admin UI conventions. The initial migration creates the
fixed admin account once; never overwrite a changed password on redeploy.

Create and maintain the documentation required by the plan while coding.
Keep implemented behavior, proposed defaults, and unfinished work distinct.
Run appropriate checks and update the implementation tracker with actual
results. Resolve routine implementation choices autonomously and document
significant decisions in ADRs. Report any actual missing external prerequisites
without blocking unrelated work.
```
