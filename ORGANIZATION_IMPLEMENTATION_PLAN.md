# Multi-organization implementation plan

Status: proposed execution plan. The behavior is not implemented yet.

Source specification: [`ORGANIZATION_PLAN_UPDATE.md`](ORGANIZATION_PLAN_UPDATE.md). If this plan and the source specification differ, resolve the specification first, update both documents, and only then implement the affected package.

## 1. Objective and delivery strategy

Convert the current one-business deployment into a multi-organization platform without losing existing business, booking, conversation, queue, preview, analytics, or administrator data.

Deliver the change as compatible packages. Add and backfill tenant scope before requiring it, keep the current root webhook available throughout rollout, import environment credentials before removing environment reads, and do not route a second organization until isolation checks pass.

Each package must:

1. update the requirements/ADR/current-behavior documentation affected by that package;
2. include application tests for new behavior, without adding Supabase migration tests or migration-test CI;
3. apply only new timestamped migrations;
4. regenerate `src/generated/database.types.ts` after schema changes;
5. pass `pnpm check` before handoff.

## 2. Fixed implementation decisions

These decisions remove ambiguity from the source specification.

### 2.1 Organization and business profile

- Add `organizations` as the tenant root.
- Keep `businesses` as the customer-facing business profile.
- Enforce exactly one business per organization with non-null unique `businesses.organization_id`.
- Organization name is the platform tenant label. Business name is customer-facing and may later differ.
- Creating an organization creates its business profile, settings, and empty provider-settings row in one transaction, using the submitted organization name for both initial names.
- Organization lifecycle is `active` or `archived`. Real WhatsApp enablement is a separate flag. A new organization is active for dashboard setup and disabled for real WhatsApp.

### 2.2 Contacts and identity

- Make `contacts` organization-scoped.
- Replace global `contacts.wa_id` uniqueness with `(organization_id, wa_id)`.
- The same phone number in two organizations produces two contact rows. Profile names, timestamps, histories, drafts, quotas, roles, bookings, and tool executions therefore cannot leak through a shared contact record.
- Business owners and technicians remain WhatsApp-only roles and gain no browser permissions.

### 2.3 Admin roles and route scope

- Keep `platform_admins` as the dashboard account profile table and add `is_system_admin`.
- Add active organization memberships in `organization_admin_memberships`.
- System administrators can access all organizations and all account/root settings operations.
- Organization administrators can access only their active memberships.
- Put organization scope in page and API paths:

  ```text
  /admin
  /admin/system/accounts
  /admin/system/meta
  /admin/organizations/{organizationId}
  /admin/organizations/{organizationId}/{resource}

  /api/admin/system/accounts
  /api/admin/system/meta
  /api/admin/organizations/{organizationId}/{resource}
  ```

- Use `/admin/account` as the global signed-in user's password/profile page.
- In Next.js 16 pages and route handlers, await dynamic `params`, validate `organizationId`, then authorize it before reading or mutating tenant data.

### 2.4 Settings ownership

Use these records:

| Record                               | Scope        | Purpose                                                                                                                   |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `organizations`                      | Platform     | Tenant identity, lifecycle, archive actor/time                                                                            |
| `businesses`                         | Organization | One editable public business profile                                                                                      |
| `organization_settings`              | Organization | Timezone, hours, interval, bot locale, preview limits, simulator enablement                                               |
| `organization_provider_settings`     | Organization | WABA/phone IDs, validated display/E.164 number, real-WhatsApp enablement, Meta override bundle, OpenAI key/models/pricing |
| `root_meta_settings`                 | Platform     | Root Meta bundle and default technician templates                                                                         |
| `provider_configuration_validations` | Organization | Sanitized last validation state, failure code, timestamp, and validated configuration version                             |
| `organization_admin_memberships`     | Platform     | Active account-to-organization assignments                                                                                |
| `audit_log`                          | Mixed        | Explicit platform or organization scope; organization events require an organization ID                                   |

- Replace the singleton `platform_settings` runtime role with `organization_settings`.
- Copy current platform settings to the default organization.
- Move current technician template names to root defaults and leave default-organization template overrides null.
- Store `BOT_LOCALE`, timezone/defaults, preview limits, and simulator enablement per organization.
- Store the OpenAI API key, chat/image models, and pricing configuration per organization. Never fall back to another organization's OpenAI configuration.

### 2.5 Credential storage

Store Meta access tokens, app secrets, webhook verify tokens, and organization OpenAI keys as plain database text. This project explicitly accepts database-level plain-text storage to avoid another encryption-key environment value and key-rotation workflow.

- Keep credential tables server-only. Browser code never queries them directly; every settings request passes the system or organization authorization guard before using the service-role client.
- Enable RLS and grant no direct authenticated credential-table access beyond narrowly defined server operations.
- Store a three-field Meta override atomically. Database checks require all three trimmed values or all three null.
- Return saved Meta credentials only from authorized no-store editing APIs. Organization responses never contain inherited root credentials. OpenAI keys are write-only and return only configured/not-configured state.
- Never expose credential values through logs, audit details, job payloads, cache keys, errors, exports, analytics, AI prompts, or fixtures.
- Audit changed field names, actor, scope, and time only.

### 2.6 Configuration readiness

Treat saved configuration, validation, and enablement as separate states:

1. **Incomplete:** required identifiers or selected credentials are missing.
2. **Unvalidated:** fields are complete but no validation matches the current fingerprint.
3. **Invalid:** the last matching validation failed.
4. **Ready, disabled:** identifiers/credentials validate but real traffic is off.
5. **Enabled:** ready and explicitly enabled on an active organization.

Changing WABA ID, phone ID, credential source, or access token increments a non-secret configuration version and invalidates prior validation. Provider validation confirms that the phone appears under the configured WABA and is accessible with the effective token. On success, save Meta's returned display phone number and normalized E.164 digits for customer click-to-chat. Persist only sanitized status, bounded failure code, time, validated configuration version, and those non-secret customer-facing phone values.

### 2.7 Customer click-to-chat QR

`phone_number_id` is an internal Graph identifier. Generate customer QR codes from the validated real WhatsApp number:

```text
https://wa.me/{e164Digits}
```

- Normalize Meta's returned display number to international digits without `+`, spaces, or punctuation; reject it if a valid E.164 destination cannot be produced.
- Do not add a prefilled message. Scanning opens the organization's WhatsApp conversation; the customer writes and sends the first message to trigger the webhook and AI.
- Generate the QR locally in the application. Do not send the phone/link to an external QR-generation service.
- Show the phone number, clickable/copyable link, and downloadable/printable QR only after current provider validation succeeds for an active organization.
- Clear the saved display/E.164 values when phone ID changes. Do not accept a manually typed display number as validation.
- Put no organization ID, credential, Vercel bypass value, or authorization data in the QR. The signed receiving phone/WABA metadata remains the only tenant-routing input.

## 3. Database plan

### 3.1 Tables receiving direct organization scope

Add `organization_id not null` to every operational row, even where a parent already implies it.

| Area                  | Tables                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| People and catalog    | `contacts`, `business_owners`, `salons`, `services`, `service_salons`, `technicians`, `technician_time_off`, `business_customers` |
| Bookings              | `bookings`, `booking_services`, `booking_events`                                                                                  |
| Conversations         | `conversations`, `conversation_messages`, `booking_drafts`, `interactive_prompts`, `tool_executions`                              |
| Ingress and delivery  | `whatsapp_inbox_events`, `job_outbox`, `message_outbox`                                                                           |
| Preview/observability | `preview_usage`, `preview_requests`, `ai_usage_events`, organization-scoped `audit_log`                                           |

For each parent table add a unique `(organization_id, id)` key. Use composite foreign keys such as `(organization_id, booking_id)` and `(organization_id, conversation_id)` so a child cannot claim another organization's parent.

Keep `bookings.technician_ref` nullable and without a foreign key. Application/RPC checks still accept a current technician only when it belongs to the selected salon and organization.

### 3.2 Tenant-aware uniqueness

Replace or add these constraints/indexes:

| Purpose                     | Key                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Contact identity            | `(organization_id, wa_id)`                                                              |
| Conversation                | `(organization_id, contact_id, channel)`                                                |
| Provider inbox idempotency  | `(organization_id, provider_event_id)`                                                  |
| Saved provider message      | `(organization_id, provider_message_id)` where non-null                                 |
| Outbox idempotency          | `(organization_id, deduplication_key)`                                                  |
| Booking tool idempotency    | `(organization_id, idempotency_key)`                                                    |
| Preview request idempotency | `(organization_id, contact_id, request_key)`                                            |
| Preview daily quota         | `(organization_id, contact_id, usage_date)`                                             |
| Organization business       | unique `businesses.organization_id`                                                     |
| Organization provider IDs   | unique non-null WABA ID and unique non-null receiving phone ID across all organizations |

Archived organizations retain WABA/phone ownership. Normalize surrounding whitespace and retain provider IDs as strings.

### 3.3 Simulator booking source

- Add `bookings.simulated boolean not null default false`.
- Backfill all existing rows to false.
- Prevent later updates with a database trigger or column-specific update guard.
- Set the value in booking SQL from the verified conversation channel. Do not accept it from browser input, WhatsApp text, or tool arguments.

### 3.4 Indexes

Put `organization_id` first in high-volume indexes for:

- contact/role lookup;
- conversation and message history;
- booking created/start ranges;
- inbox provider IDs and period queries;
- pending/failed job and message recovery;
- provider delivery-status lookup;
- AI usage periods;
- preview quota and stale-preview recovery;
- tenant audit queries.

Workers may scan pending rows across organizations, but selected rows already carry immutable scope and subsequent updates include row ID plus organization ID.

### 3.5 RLS and SQL functions

- Add `is_system_admin()` and `is_organization_admin(uuid)` security-definer helpers.
- Allow dashboard accounts to read their own profile and memberships.
- Tenant table policies compare row organization ID with an active membership or system role.
- Continue requiring browser operations to use authenticated route handlers and shared SWR fetchers.
- Service-role handlers must still filter explicitly because service role bypasses RLS.
- Add `p_organization_id` to `register_whatsapp_event`, preview reservation/completion, booking create/cancel/update, staff summaries, inbox projection, and platform-activity reporting.
- Every RPC verifies that supplied contact, conversation, salon, service, technician, booking, and parent rows match that organization before reading or writing.

## 4. Application context and contracts

### 4.1 Authorization guards

Implement:

```ts
requireApiAdmin(): Promise<AdminIdentity>
requireSystemAdmin(): Promise<SystemAdminIdentity>
requireOrganizationAdmin(
  organizationId: string,
  options?: { allowArchivedRead?: boolean },
): Promise<OrganizationContext>
```

`OrganizationContext` contains the trusted organization ID, business ID, lifecycle/name, account ID, system-role flag, and permissions required by the caller. Lower-level modules accept this context and never select the first business or infer dashboard scope from request bodies.

### 4.2 Provider resolvers

Create one effective Meta resolver that returns:

- organization/WABA/phone IDs;
- Root or Organization source;
- stored server-only credentials;
- confirmed/cancelled template choice and source;
- callback route selection;
- validation/readiness/enablement state;
- sanitized fingerprint.

Create a separate OpenAI resolver for the organization's stored key, models, and price configuration. Cache clients only by organization ID plus configuration version. Remove process-wide singleton clients after cutover.

### 4.3 Durable context

Persist organization ID at ingress and pass it through:

```text
normalized webhook
  -> whatsapp_inbox_events
  -> job_outbox / Inngest event
  -> contact + conversation + tool context
  -> booking / preview / AI usage
  -> message_outbox
  -> WhatsApp delivery or simulator capture
```

Jobs contain IDs and provider identifiers only. They load credentials on the server. Retries keep the original organization even if credentials, memberships, or the dashboard selection later change.

## 5. Implementation packages

### Package 0: Requirements and ADRs

Work:

- Add stable requirement IDs for organization isolation/lifecycle, system and organization admin roles, provider routing, per-organization settings, and simulator booking isolation.
- Add an ADR superseding ADR 0001 with the tenant boundary, contact model, one-to-one business profile, provider routing, dual callbacks, and server-only plain-text credential storage.
- Revise ADR 0009 for system/organization accounts, direct initial/reset passwords, soft removal/ban, and last-system-admin protection.
- Keep implementation status truthful: later packages remain proposed until deployed and verified.

Exit gate:

- Schema names, route layout, credential-storage decision, account removal semantics, and rollout order are accepted.

### Package 1: Additive organization and account schema

Work:

- Create organization, membership, root/organization settings, provider settings, provider validation, and role-helper records in a new timestamped migration.
- Seed a deterministic default organization.
- Attach the current business to it and copy singleton settings.
- Mark the migration-created admin as a system administrator.
- Add nullable organization columns, backfill from parent relationships, assert no null/orphan/mismatch, then enforce non-null/composite constraints.
- Add tenant-aware uniqueness/indexes/RLS.
- Add/backfill/lock the simulator booking flag.
- Keep old SQL signatures/runtime compatible for this deployment. Add versioned functions or a temporary default-organization bridge where necessary; remove the bridge in Package 8.

Verification:

- Manual SQL checks show one organization for every operational row and no mismatched composite relation.
- A fresh database contains the default organization/business without fabricated provider values.
- Duplicate WABA/phone values are rejected.
- Existing admin login and current application flow still work.
- Run `pnpm db:types` and `pnpm check`.

### Package 2: Settings, bootstrap, and validation

Work:

- Add repositories for root Meta, organization settings, organization provider settings, and validation state.
- Implement effective Meta/template/OpenAI resolvers and callback URL builder.
- Add `VERCEL_AUTOMATION_BYPASS_SECRET` to the callback builder using the URL API and `x-vercel-protection-bypass` query parameter.
- Add a rerunnable server-side bootstrap script. It imports existing environment values only when destination fields are unset:

  - Meta access token, app secret, and verify token -> root settings;
  - WABA ID and phone ID -> default organization;
  - OpenAI key/models/pricing -> default organization;
  - current template names -> root defaults through migration;
  - default organization Meta overrides remain null.

- Add a system-only provider-validation command. A successful validation saves Meta's display phone number and normalized E.164 digits; a phone-ID change clears them.

Verification:

- Bootstrap reruns do not overwrite administrator edits.
- The default organization resolves the same effective configuration as the current deployment.
- A complete organization override works without root Meta settings.
- Invalid/missing override credentials fail without root fallback.
- Callback tests cover encoding, existing query parameters, and the unset bypass value.
- Logs/snapshots contain no secret values.

### Package 3: Webhook routing and durable delivery

Work:

- Extend webhook normalization with `entry.id` WABA and `value.metadata.phone_number_id` for every message/status.
- Reject changes missing routing metadata before registration.
- Split webhook receiving into normalization, route verification/routing, and organization-scoped registration.
- Root route:

  1. verify the exact raw body with the root app secret;
  2. resolve each change independently by phone ID;
  3. confirm WABA ID;
  4. verify its effective app secret, caching HMAC results by unique secret for the request;
  5. register valid changes under their organization and skip permanently unroutable changes with sanitized diagnostics.

- Organization route:

  1. load the path organization and effective bundle;
  2. verify the exact raw body;
  3. assert all changes match its WABA and phone before any write;
  4. register with organization scope.

- Keep `src/app/api/whatsapp/webhook/route.ts` and add `src/app/api/whatsapp/webhook/[organizationId]/route.ts`.
- Add organization ID to inbox/job/outbox rows, RPCs, Inngest payloads, recovery, concurrency keys, and delivery-status predicates.
- Use `${organizationId}:${contactWaId}` for conversation concurrency.
- Refactor WhatsApp send/media functions to accept resolved organization configuration.

Verification:

- Mixed-organization root batches route independently.
- Shared-root and separate-app configurations verify correctly.
- Wrong signature/path/WABA/phone, unknown mappings, missing metadata, and archived organizations create no new tenant work.
- The same event delivered through both valid routes creates one effect.
- Status callbacks update only the matched organization's message.
- Recovery retains organization scope.
- Complete a signed default-organization smoke test before production callback changes.

### Package 4: Conversation, booking, notification, preview, and AI

Work:

- Add organization and business IDs to `ConversationActor` and processing context.
- Upsert contacts/conversations on organization-aware keys.
- Scope owner/technician resolution to ingress organization.
- Replace singleton/first-business reads in conversation response, tools, datetime, localization, notifications, simulator, and admin resource helpers.
- Add organization arguments/checks to all booking, preview, and staff RPC calls.
- Preserve flexible bookings, nullable salon/technician, update-in-place, timezone, cancellation, idempotency, and image privacy invariants.
- Centralize template choice. Queue selected name/language/five parameters/source in the immutable outbox payload. Do not reselect templates during retries.
- Resolve OpenAI configuration for each organization for chat, localization, and image calls.
- Insert organization ID in AI usage before provider invocation.

Verification:

- Run the same WA ID in two organizations and prove separate contacts, histories, drafts, locales, quotas, tool executions, bookings, and AI usage.
- Owner/technician mappings grant access only inside their organization.
- Cross-organization entity IDs fail in every tool/RPC.
- Existing booking/notification/preview behaviors remain covered.

### Package 5: Simulator and source-safe reports

Work:

- Move simulator enablement to organization settings, retaining the environment switch temporarily as a platform ceiling.
- Scope simulator actors/messages/history to the selected organization.
- Set booking `simulated` from verified simulator context.
- Exclude simulated bookings from real owner/technician WhatsApp tools and default operational totals.
- Add Real/Simulator/Both to booking table, counts, trends, and CSV when that organization enables simulation.
- When disabled, hide the selector and return only real bookings.
- Scope activity, AI usage, inbox, and queue health to organization before applying source/date aggregation.

Verification:

- No source or organization mixing occurs in bookings, metrics, CSVs, inbox, staff answers, notifications, or delivery.
- Disabling one simulator does not affect another organization.
- Simulated delivery never calls Meta.

### Package 6: Admin routes, shell, organizations, and accounts

Work:

- Extend admin identity with system role and memberships.
- Add system/organization guards.
- Move existing pages and API handlers into scoped route trees.
- Convert `/admin` into the organization landing page with bounded pagination.
- Add system-only organization create/archive/recover and account management.
- Organization creation transaction creates organization, business, settings, and provider rows.
- Rebuild shell navigation with organization switcher, visible scope name, role-aware links, and archived read-only state.
- Add organization Accounts page; organization admins may view members, while system admins perform create/assign/remove/reset/system-role actions.
- Create Auth users with supplied initial passwords and `email_confirm=true`; set `must_change_password=true`.
- Password reset uses Auth admin update and sets `must_change_password=true`.
- Define Remove as deactivating the dashboard profile, revoking memberships, and banning the Auth user while preserving its UUID/audit history.
- Protect the last active system administrator in a locked database transaction.
- Add organization ID to every SWR key/API path. Clear sensitive caches/forms on switch, sign-out, deactivation, and 403.

Verification:

- Test system access, one/multiple memberships, forged organization IDs, archived reads/mutations, revoked membership, forced password change, and final-system-admin protection.
- Every organization page visibly identifies its scope.
- No organization route uses unscoped service-role queries.

### Package 7: Provider settings UI, template guide, and marketing

Work:

- Add system-only root Meta settings page/API with `Cache-Control: private, no-store`.
- Add organization provider settings and source/readiness/validation/enablement UI.
- Add a customer QR card after successful phone validation. Generate a click-to-chat QR locally from the saved E.164 digits, with visible number/link, copy, download, and print actions. Explain that scanning opens the conversation and the customer starts it by writing and sending a message.
- Return saved organization overrides to authorized editors, never inherited root values.
- Use password inputs with show/hide for editable secrets.
- Extract the technician-template guide into a shared component driven by one placeholder/body definition.
- Show copyable placeholder bodies separately from fictional filled examples.
- Show Root, Organization, or No template independently for confirmation/cancellation.
- Show explicit Incomplete, Unvalidated, Invalid, Ready/disabled, and Enabled states.
- Update the German marketing page and remove `NEXT_PUBLIC_WHATSAPP_NUMBER` and the shared booking-number CTA.

Verification:

- Root and cross-organization credential disclosure is rejected.
- Organization administrators see no inherited root secret.
- Sensitive responses are not shared-cached or retained after scope/sign-out changes.
- Template previews use all five values in runtime order and make no AI/provider call.
- Marketing build contains no public WhatsApp-number dependency.
- QR output encodes the expected `wa.me` URL, contains no credential/scope data, and is unavailable for stale, invalid, or archived phone mappings.

### Package 8: Cutover and cleanup

Work:

- Deploy in order: compatible schema, settings/bootstrap, dual webhooks, organization runtime, scoped dashboard, provider cutover.
- Validate in dev with:

  1. default organization inheriting root Meta;
  2. second organization using the same root app with unique WABA/phone;
  3. organization using a complete separate-app override.

- Inspect every pending inbox/job/message/preview row for organization scope before cutover.
- Configure Meta callbacks/subscriptions manually and enable organizations one at a time.
- After all runtime readers are scoped, remove:

  - default-organization inference;
  - `businesses.singleton` and its unique index;
  - old singleton `platform_settings`;
  - process-wide provider clients;
  - runtime reads of legacy Meta/OpenAI/simulator environment values;
  - compatibility SQL signatures/bridges;
  - `NEXT_PUBLIC_WHATSAPP_NUMBER`.

- Keep the root webhook permanently.
- Roll back live traffic by disabling an organization's WhatsApp flag. Do not delete mappings, queues, credentials, or history during rollback.

Verification:

- Search `src` for singleton business/settings reads and unscoped operational queries.
- Run database mismatch/null-scope assertions.
- Verify both callback forms behind Vercel protection.
- Run `pnpm db:types` after final schema changes and `pnpm check`.

## 6. File-level change map

| Area                 | Existing files to revise                                                                                                                                                                                                 | Expected additions                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Schema and RPCs      | `supabase/migrations/*`, `src/generated/database.types.ts`                                                                                                                                                               | Organization/backfill, provider settings, scoped RPC, and cleanup migrations                     |
| Auth and context     | `src/lib/auth/admin.ts`, `src/lib/auth/api-admin.ts`, `src/lib/supabase/*`                                                                                                                                               | System/organization guards and organization context/repository modules                           |
| Configuration        | `src/lib/config/env.ts`, `.env.example`                                                                                                                                                                                  | Meta/OpenAI resolvers, bootstrap script, provider-validation service, and local QR generator     |
| WhatsApp ingress     | `src/app/api/whatsapp/webhook/route.ts`, `src/features/messaging/receive-webhook.ts`, `src/integrations/whatsapp/{types,normalize,security,client}.ts`                                                                   | Dynamic organization webhook route and provider validation service                               |
| Durable work         | `src/inngest/{client,functions}.ts`, `src/features/messaging/{chat,outbox}.ts`, `src/features/conversation/process-event.ts`                                                                                             | Organization-scoped job payload contracts                                                        |
| Conversation/domain  | `src/features/conversation/{respond,reply,tools,datetime,localize,notifications}.ts`, `src/features/previews/process.ts`, `src/features/ai-usage/*`, `src/integrations/openai/client.ts`                                 | Provider factories and template resolver                                                         |
| Admin data/reporting | `src/features/admin/*`, `src/features/bookings/admin-query.ts`, `src/features/analytics/*`, `src/features/inbox/*`, `src/features/simulator/*`, all `src/app/api/admin/**/route.ts`                                      | Scoped system/organization services and route folders                                            |
| Admin UI             | `src/app/admin/(protected)/**`, `src/components/admin/{admin-shell,resource-manager,settings-client,bookings-client,dashboard-client,platform-activity-client,inbox-client,simulator-client}.tsx`, `src/lib/api/keys.ts` | Organization/system route trees, switcher, account/provider/template clients                     |
| Marketing/docs       | `src/app/(marketing)/*`, `docs/**`, `AGENTS.md`, `DEVELOPMENT_PLAN.md`                                                                                                                                                   | Multi-organization ADR and rollout documentation                                                 |
| Tests                | Existing webhook, conversation, simulator, settings, analytics, inbox, resource, and provider tests                                                                                                                      | Credential/context/account tests and reusable two-organization fixtures; no migration-test suite |

## 7. Required test matrix

### 7.1 Isolation

- Same WA ID across two organizations.
- Same provider event ID across two organizations.
- Same tool call/deduplication key across two organizations.
- Forged salon/service/technician/booking/conversation/preview IDs from another organization.
- Owner in organization A and customer in B.
- Technician in multiple organizations with separate histories and assignments.
- Cross-organization delivery-status collision.
- Queue retry after dashboard membership or active selection changes.

### 7.2 Provider configuration

- Root bundle unset, complete, invalid, and rotated.
- Organization override all null, complete, partial, explicitly cleared, and omitted/preserved.
- Duplicate WABA and duplicate phone ID.
- Shared app/root credentials with different WABAs.
- Complete separate-app override without root configuration.
- Root callback, organization callback, and duplicate delivery through both.
- Vercel bypass absent, encoded, and combined with Meta `hub.*` parameters.
- Validation configuration-version invalidation after each relevant field changes.
- Meta display-number retrieval, E.164 normalization, phone-ID-change clearing, and click-to-chat URL encoding.
- QR generation is local and the decoded payload contains only the expected `wa.me` destination, without query parameters or prefilled text.

### 7.3 Technician templates

For confirmation and cancellation independently:

| Meta source           | Organization template | Expected result                    |
| --------------------- | --------------------- | ---------------------------------- |
| Root                  | Set                   | Organization template              |
| Root                  | Blank                 | Root default or ordinary message   |
| Organization override | Set                   | Organization template              |
| Organization override | Blank                 | Ordinary message, no root fallback |

Also cover reassignment/rescheduling, duplicate queueing, settings changes after queueing, unapproved-template failure, simulator capture, and all five placeholder values.

### 7.4 Accounts and UI

- Migration-created system admin.
- Organization-only admin with one and multiple memberships.
- Account create failure between Auth and database steps.
- Initial/reset password forced change.
- Membership revocation during an active session.
- Deactivation/removal and last-system-admin rejection.
- Archived organization read-only behavior.
- SWR cache isolation and credential-form clearing on scope changes.
- Root settings hidden from organization administrators.

### 7.5 Reporting and simulator

- Real, Simulator, and Both filters for table/count/chart/CSV.
- Disabled simulator hides historical simulated bookings from normal views.
- Simulated bookings excluded from staff WhatsApp tools and real notifications.
- Organization/date/source filters apply before aggregation.
- AI usage and queue health stay organization-scoped.

## 8. Manual database assertions

Run read-only assertions after each backfill and before cutover:

- no operational `organization_id` is null;
- each child's organization equals every referenced parent's organization;
- each organization has exactly one business and one organization-settings row;
- no two organizations share non-null WABA or phone IDs;
- every tenant audit row has organization scope and every platform audit row does not;
- every pending inbox/job/message/preview/AI row has scope;
- no simulated booking changed its source flag;
- no legacy row was assigned outside the default organization;
- credential columns are accessible only through intended server paths and contain no placeholder mask values.

Do not turn these checks into automated Supabase migration tests or a migration-test CI job.

## 9. Documentation updates by package

Update these with the implementation package that changes their behavior:

- `docs/product/requirements.md`
- `docs/product/conversation-flows.md`
- `docs/product/analytics.md`
- `docs/architecture/overview.md`
- `docs/architecture/data-model.md`
- `docs/architecture/authorization.md`
- `docs/architecture/conversation-state.md`
- `docs/architecture/platform-observability.md`
- `docs/integrations/whatsapp.md`
- `docs/integrations/openai.md`
- `docs/development/configuration.md`
- `docs/development/admin-ui.md`
- `docs/operations/deployment.md`
- `docs/operations/runbooks.md`
- `docs/implementation-status.md`
- `.env.example`
- `AGENTS.md`
- `DEVELOPMENT_PLAN.md`

Document environment values as bootstrap-only before removal. Document `VERCEL_AUTOMATION_BYPASS_SECRET` as server-only. Keep live Meta subscription/template approval checks under provider validation required until actually exercised.

## 10. Definition of done

The update is complete only when:

- every operational record and request path has enforced organization scope;
- the default organization's existing data and behavior are preserved;
- system and organization admin permissions pass the test matrix;
- real and simulator traffic remain separated by organization and source;
- root and organization Meta configurations route, verify, send, and retry correctly;
- credentials are stored in server-only database fields, access-controlled, and auditable without values;
- each currently validated organization can expose a customer-safe click-to-chat link and QR for its real registered WhatsApp number;
- reports, inbox, CSVs, AI usage, health, and staff tools cannot cross organizations;
- the German landing page no longer advertises one shared booking number;
- compatibility singleton/environment paths are removed after cutover;
- documentation describes the deployed state accurately;
- `pnpm db:types` has regenerated types for the applied schema;
- `pnpm check` passes on Node.js 22 with pnpm 12.4.1;
- required real-provider checks are recorded separately from automated tests.
