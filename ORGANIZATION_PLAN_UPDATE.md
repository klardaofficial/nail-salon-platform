# Organization and account-management update

## Goal

Convert the current single-business deployment into a multi-organization platform. An organization is the tenant boundary: its data, conversations, provider configuration, staff mappings, reports, and operational settings must be isolated from every other organization.

The public landing page becomes marketing for the platform, not a booking page for one salon. It must not depend on `NEXT_PUBLIC_WHATSAPP_NUMBER` or direct visitors to a shared booking number.

## Organization model

- An organization represents an independently managed salon business. It owns its salons, services, technicians, business owners, bookings, reports, WhatsApp conversations, message queues, previews, and AI-usage records.
- Creating an organization requires only its name. The system generates its unique immutable organization ID; the organization name can be updated later by a system administrator or an assigned organization administrator. WhatsApp configuration is optional at creation time and can be added later by the same authorized roles. Renaming never changes the organization ID, callback URL, provider mappings, or historical records.
- Every tenant-owned record, read model, report, export, background job, and provider operation is associated with exactly one organization.
- A WhatsApp contact may exist across organizations, but conversations, bookings, preview limits, message history, and role mappings remain organization-specific. A customer using the same WhatsApp number with two organizations must never see data from one organization in the other.
- An organization may be active or archived. Only a system administrator can archive or recover an organization; organizations are never permanently deleted. Archived organizations retain history but do not accept new booking work or send new operational messages.
- Existing data is assigned to one migration-created default organization. A fresh, empty database must also create this default organization automatically.

## Provider routing and configuration

Each organization has its own Meta app, WhatsApp Business Account (WABA), WhatsApp configuration, and OpenAI configuration. Provider credentials and webhook setup are not shared between organizations.

- Each organization has a stable callback URL, `https://{app-domain}/api/whatsapp/webhook/{organizationId}`. Meta's per-WABA callback override points to that URL. The path organization ID selects the candidate organization and is persisted during webhook ingestion, before any conversation or background work begins.
- The webhook still verifies Meta's signature using that organization's stored secret and confirms that the payload's receiving phone-number ID matches the organization's configured WhatsApp number. The path ID alone never authorizes a request.
- The stored organization identity is used by all retries and durable jobs. No later worker may infer its tenant from mutable browser input or an unscoped lookup.
- Outbound WhatsApp messages always use the configuration belonging to the message's organization.
- OpenAI calls, image-preview limits, model selection, pricing estimates, notification templates, timezone, business defaults, salon configuration, and simulator enablement use the organization settings belonging to the current organization.
- Unknown, inactive, or incompletely configured provider identities fail safely and create actionable, organization-safe operational diagnostics.

Provider credentials must be treated as secrets:

- Store organization-specific credentials encrypted at rest, protected by a server-only platform encryption key or managed key service.
- Never return decrypted credentials through browser APIs, dashboard pages, logs, exports, job payloads, error messages, or AI prompts.
- Settings pages show masked state and allow replacement/rotation, rather than displaying saved secret values.
- Record security-relevant changes such as credential replacement, organization activation, and administrator membership changes in an audit trail.

Platform-wide infrastructure remains environment configuration: Supabase credentials, Inngest credentials, application URL/environment, server-side encryption material, and global feature flags. These are not organization settings.

Existing environment values cannot be copied into the database by a SQL migration. The rollout needs a one-time, server-side bootstrap/import step that transfers the existing WhatsApp/OpenAI configuration into the default organization's encrypted settings, then validates that configuration before the old environment-based runtime path is removed.

## Account and authorization model

The current single admin account becomes a system-role account. System-role accounts are platform operators and are not limited to one organization.

### System administrators

- A system administrator can create organizations, activate/deactivate them, select any organization, and manage organization memberships.
- Only a system administrator may create an account, set its real initial password directly, reset a password, remove an account, or change an account's system role. Account creation and password reset do not rely on email invitations or password-setup links.
- System administrators can create organization-admin accounts and assign each one to one or more organizations.
- System administrators may manage their own profile but account lifecycle actions must remain protected from accidental loss of the final system administrator.

### Organization administrators

- An organization administrator can access only organizations to which they have an active membership.
- They can manage all operational data, WhatsApp/OpenAI configuration, and settings of their assigned organizations. More granular organization roles may be introduced later, but are out of scope for this update. They cannot create accounts, reset passwords, remove accounts, grant system roles, or change membership outside their own authorized organization scope.
- A user may be an organization administrator for one or many organizations. Their active organization is selected in the dashboard, and every browser request rechecks that membership server-side.

### WhatsApp staff

- Business owners and technicians remain WhatsApp-only roles. Their stored WhatsApp mappings are organization-scoped and never grant browser-dashboard access.
- WhatsApp role resolution, tool authorization, bookings, notifications, and staff summaries always use the organization determined at ingress.

## Dashboard experience

- The protected admin root page displays the signed-in user's available active organizations in a paginated table. System administrators see every organization; organization administrators see only their active memberships. Each row opens that organization's scoped dashboard.
- System administrators have an Archived organizations filter on the root organization table. They can inspect archived organizations and recover them; organization administrators cannot view, archive, or recover archived organizations.
- For system administrators, the root page also displays a paginated account table. It supports creating an account, assigning it to one or more organizations during creation, and resetting an administrator account's password. Password reset remains unavailable to organization administrators and is handled without displaying the current or new password in tables, logs, or audit details.
- Add an organization switcher for system administrators and multi-organization administrators. The current organization must be clearly visible on every organization-scoped page.
- Add a system-only organization-management area for creating organizations by name, assigning administrators, viewing configuration health, and archiving/recovering organizations. A newly created organization can remain unconfigured until an authorized administrator adds its own Meta app, WhatsApp Business Account, and phone-number configuration.
- In each authorized organization's settings, display its generated WhatsApp callback URL and a concise Meta setup checklist: configure that exact URL as the WABA callback override, provide the matching verification token, and subscribe to the `messages` webhook field. Show configuration health and masked credential presence, never the saved secret values.
- Each organization has an Accounts page listing all accounts assigned to that organization in a paginated table. Assigned organization administrators can view the list, but only system administrators see the action to create a new administrator already assigned to that organization.
- Add a system-only account-management area for creating accounts, assigning/removing organization memberships, resetting passwords, changing permitted roles, and removing accounts.
- Existing business, salon, service, technician, settings, inbox, simulator, analytics, and export screens operate only in the selected authorized organization context.
- Browser-supplied organization IDs are only selectors; route handlers independently verify the signed-in user's system role or active organization membership before using them.

### Organization-scoped simulator and booking data

- The WhatsApp simulator is enabled or disabled per organization, rather than globally for the whole application. An authorized administrator can enable it only for the selected organization.
- Simulator ingress, conversations, messages, AI usage, queues, and all simulator-created bookings carry an immutable simulator/source flag from creation through retries and reporting.
- Add a booking flag that identifies simulator-created bookings. Existing bookings with no flag are treated as real bookings during the migration and at runtime.
- When simulator is enabled for the selected organization, booking screens expose the same source filter used by activity/AI-usage views: Real, Simulator, or Both. The selected filter applies consistently to booking tables, counts, charts, and CSV exports that include booking data.
- When simulator is disabled for the selected organization, hide the source filter and show only real bookings. Historical simulator bookings remain retained but are not included in ordinary booking views, metrics, or exports while the simulator is disabled.
- A simulator booking must never be mixed into real operational totals by default, accidentally trigger real WhatsApp delivery, or be visible to WhatsApp owners/technicians as a live customer appointment.

## Data and migration approach

Use additive, timestamped migrations. Do not modify applied migrations.

1. Introduce organizations, account roles, and administrator-to-organization memberships. Seed a default organization for both existing and empty databases.
2. Add and backfill `organization_id` across every tenant-owned table, including conversations, inbox events, drafts, tool executions, message/job outboxes, previews, AI usage, analytics inputs, and audit records. Add the immutable simulator-booking flag with a real/default interpretation for all existing bookings.
3. Update foreign keys, indexes, uniqueness constraints, RLS policies, and database functions so organization scope is mandatory and enforced in SQL.
4. Backfill all existing rows into the default organization while preserving booking references, timestamps, historical snapshots, and message/provider identifiers.
5. Add encrypted organization settings and run the one-time server-side import of existing WhatsApp and OpenAI environment configuration into the default organization.
6. Change webhook ingestion, background jobs, provider adapters, conversation tools, admin APIs, reporting, and simulator flows to propagate and enforce organization context.
7. Remove singleton constraints and old runtime configuration only after the organization-scoped path is verified and operating.
8. Regenerate database types after schema changes and validate the transition with representative default-organization data plus a second organization.

## Safety and acceptance principles

- No query, RPC, API, job, cache key, idempotency key, queue row, export, or provider request may cross organization boundaries.
- A retry must continue under the organization captured at original ingestion/queueing time, even if the user's active dashboard selection later changes.
- Simulator enablement is evaluated against the organization captured by the event or booking; switching another organization's setting must not affect it. New simulator bookings are distinguishable from real bookings throughout their lifecycle.
- Only system administrators manage user accounts and passwords. Organization membership does not grant account-administration authority.
- Deleting/removing an account must revoke access and preserve audit/history records according to retention requirements; it must not silently reassign ownership or erase organization data.
- The platform must retain at least one active system administrator at all times.
- Existing image-byte privacy, service-role secrecy, WhatsApp signature verification, staff-mapping verification, and idempotent booking/message behavior remain unchanged.

## Documentation and rollout updates

Before implementation, replace single-business assumptions in the product requirements, architecture overview, data model, authorization model, WhatsApp integration, configuration reference, admin UI documentation, and implementation status. Supersede ADR 0001 with a new ADR that records the multi-organization boundary, webhook-routing strategy, credential-storage design, and system-administrator authority model.

The rollout should be staged: introduce the schema and default organization, import/validate default credentials, switch runtime traffic to organization-scoped paths, verify isolation with a second organization, then remove deprecated environment values such as `NEXT_PUBLIC_WHATSAPP_NUMBER` and the old singleton-only behavior.
