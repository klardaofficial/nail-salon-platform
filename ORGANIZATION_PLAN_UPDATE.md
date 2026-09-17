# Organization and account-management update

Status: proposed implementation plan. The behavior below is not yet implemented.

## Goal

Convert the current single-business deployment into a multi-organization platform. An organization is the tenant boundary: its data, conversations, provider mappings, staff mappings, reports, and operational settings must be isolated from every other organization. Organizations may share the root Meta developer configuration or override it with their own values; sharing credentials never shares tenant data or authority.

The public landing page becomes marketing for the platform, not a booking page for one salon. It must not depend on `NEXT_PUBLIC_WHATSAPP_NUMBER` or direct visitors to a shared booking number.

## Organization model

- An organization represents an independently managed salon business. It owns its salons, services, technicians, business owners, bookings, reports, WhatsApp conversations, message queues, previews, and AI-usage records.
- Creating an organization requires only its name. The system generates its unique immutable organization ID; the organization name can be updated later by a system administrator or an assigned organization administrator. WhatsApp configuration is optional at creation time and can be added later by the same authorized roles. Before enabling real WhatsApp, require its own unique WABA ID, receiving phone-number ID, and a complete selected Meta credential bundle. Until then, show WhatsApp setup as incomplete and allow dashboard configuration and an independently enabled simulator. Renaming never changes the organization ID, callback URL, provider mappings, or historical records.
- Every tenant-owned record, read model, report, export, background job, and provider operation is associated with exactly one organization.
- A WhatsApp contact may exist across organizations, but conversations, bookings, preview limits, message history, and role mappings remain organization-specific. A customer using the same WhatsApp number with two organizations must never see data from one organization in the other.
- An organization may be active or archived. Only a system administrator can archive or recover an organization; organizations are never permanently deleted. Archived organizations retain history but do not accept new booking work or send new operational messages.
- Existing data is assigned to one migration-created default organization. A fresh, empty database must also create this default organization automatically; it remains pending WhatsApp setup until real provider identifiers and credentials are configured, without fabricated or shared WABA/phone defaults.

## Provider routing and configuration

Each organization must use a different WhatsApp Business Account ID (WABA ID, the existing `WHATSAPP_BUSINESS_ACCOUNT_ID`) and its own receiving phone-number ID. These are organization-owned routing identifiers and never inherit from root settings. The WABA ID is distinct from the Meta app ID or business portfolio ID. Several organizations may use the same Meta developer app, or an organization may use a different app through overrides. OpenAI configuration remains organization-specific.

### Root settings and organization overrides

Store one platform-level root Meta settings record and organization-level WhatsApp mappings with an optional complete Meta override bundle:

| Setting                           | Root Meta settings                        | Organization settings                                                        |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| WhatsApp Business Account ID      | No shared default                         | Required for WhatsApp; unique across organizations                           |
| Receiving phone-number ID         | No shared default                         | Required for WhatsApp; unique across organizations                           |
| Meta access token                 | Shared default                            | Required when overriding Meta settings                                       |
| Meta app secret                   | Shared default for signature verification | Required when overriding Meta settings                                       |
| Webhook verify token              | Shared default for the GET challenge      | Required when overriding Meta settings                                       |
| Technician notification templates | Optional confirmed/cancelled defaults     | Optional names, with inheritance governed by the selected Meta configuration |

- Resolve the three Meta credential fields as one bundle. All three blank/null means use the complete root Meta configuration and display the root callback URL. To override, the organization must provide all three nonempty values together; use that complete organization bundle and display the organization callback URL. Partial overrides are invalid, with no field-by-field mixing of root and organization credentials.
- Saving or replacing an override submits all three fields atomically. Submitting all three as null or blank/whitespace-only clears the bundle and restores root inheritance; omitting all three from an unrelated update preserves the saved bundle. Reject partial submissions or a mix of blank and nonblank values before changing anything. Enforce the all-null or all-present constraint in the database as well as the API. Do not store password-mask placeholders as credentials. Return Root or Organization source metadata without inherited root secret values.
- An invalid organization bundle is a configuration failure; never silently retry with root credentials. An organization can receive/send real WhatsApp traffic only when its WABA/phone mapping and complete selected Meta bundle are configured. An override may use the same app or a different app, but its app secret must match that app and its access token must be authorized for the organization's WABA/phone. A fully configured organization override does not require root Meta settings to be configured.
- Enforce WABA-ID and receiving-phone-ID uniqueness in the database, including archived organizations. Archiving does not free identifiers for another organization. Validate that the phone belongs to the configured WABA and that the effective access token can access it before reporting setup as ready.
- Root settings are resolved on the server, not copied into organization records. Root edits affect organizations using the root bundle; organizations with complete overrides remain unchanged. Invalidate affected settings caches and recompute health after a root or organization update, without requiring a deployment. Clear the complete override bundle to select the root callback again, and show the required Meta callback reconfiguration.

### Technician notification templates

- Add root defaults and organization overrides for the existing optional `technician_booking_confirmed_template` and `technician_booking_cancelled_template` names. Each notification type is optional independently; template names are not part of the mandatory three-field Meta credential bundle. An organization may override template names while continuing to use root Meta credentials, without changing its webhook URL.
- Resolve the template for each notification type using the organization's selected Meta configuration:

  | Selected Meta configuration | Organization template for this notification type | Effective template                                    |
  | --------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
  | Root                        | Configured                                       | Organization template                                 |
  | Root                        | Blank                                            | Root default, or no template if that default is blank |
  | Organization override       | Configured                                       | Organization template                                 |
  | Organization override       | Blank                                            | No template; never fall back to root                  |

- A complete Meta override with neither notification template configured is valid. One configured template does not require the other. Missing templates never block organization setup, WhatsApp enablement, or booking confirmation/cancellation. With no effective template, preserve the existing ordinary notification behavior in the technician's conversation language; Meta delivers ordinary messages only within that technician's 24-hour customer-service window. A customer's window does not open the technician's window. Display this limitation as notification health, separately from Meta credential readiness.
- Normalize blank template names to null. Clearing an organization template restores the root default only in root Meta mode; in organization Meta mode it means no template. Switching Meta mode immediately recomputes the source for new notifications, without copying root template names into organization settings. Keep saved organization template names when changing Meta credentials unless explicitly cleared.
- Template approval belongs to a WABA, not to the shared Meta app. A root default is a reusable template name/configuration, not a template shared automatically between accounts. Create and approve the matching body and language in every organization's own WABA before using a root default there. A missing, unapproved, or mismatched configured template is an organization-specific delivery/configuration failure; do not silently substitute another root template or credentials.
- Use one server-side resolver for confirmation, cancellation, rescheduling, and technician-reassignment notifications, including simulator processing. Queue the selected template name, approved language code, five body parameters, and Root/Organization/None source with the immutable organization context. Durable retries retain the queued notification payload and never reselect a root template as a fallback; setting changes apply to newly queued notifications. Preserve simulator transport isolation and notification idempotency.
- Only system administrators can edit root template defaults. System administrators and assigned organization administrators can view/edit an organization's saved template names. Organization settings responses expose those saved names plus effective source/availability, without exposing the root settings record. Root-template edits refresh health for organizations inheriting them and do not change organizations using their own Meta configuration or their own template for that notification type.

### Root and organization webhooks

Next.js supports both `GET` verification and `POST` delivery on both routes:

| Route                                    | GET verification                              | POST signature and organization selection                                                |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/api/whatsapp/webhook`                  | Root webhook verify token                     | Root app secret; resolve each event's organization from `value.metadata.phone_number_id` |
| `/api/whatsapp/webhook/{organizationId}` | Organization's effective webhook verify token | Organization's effective app secret; the path selects the candidate organization         |

- Preserve `entry.id` (WABA ID) and each change's `value.metadata.phone_number_id` through normalization for both messages and delivery statuses. The current normalizer drops these fields and must be extended before root routing can work. The sender's `from`, contact WA ID, and status `recipient_id` identify a person, not the receiving organization.
- For the root POST route, verify the exact raw request body with the root app secret before accepting payload identities. Resolve every message/status change separately by receiving phone-number ID and verify that its WABA ID also matches that organization. One signed request may contain changes for several organizations; never apply the first match to the whole request. The resolved organization's effective app secret must also authenticate the body, so a root signature cannot authorize an organization configured with a different app secret. Never try every organization's secret as a fallback for an invalid root signature.
- For the organization POST route, load the organization from the path and verify the exact raw body with its effective app secret. Confirm that all message/status changes belong to its configured WABA and receiving phone-number ID before any writes. A mismatched payload must not be relabeled or redirected to another organization. The path alone never authorizes a request, even when two organizations share the same app secret.
- The callback displayed for setup is the root URL when all three override fields are blank, and the organization's stable URL when a complete override bundle is saved. With a shared app and an organization callback, use Meta's per-WABA callback override. With a separate app, configure its callback or per-WABA override to the organization URL. Subscribe each WABA to the intended app and the `messages` field. Changing the dashboard settings does not automatically change Meta's external subscription.
- The root route may still accept correctly signed, matching events for an organization whose displayed URL is the organization route, provided its effective app secret also validates the request. This supports shared-app callback transitions. Both routes use the same organization-scoped idempotency keys, so delivering the same event through both creates one effect.
- Persist the resolved organization ID during inbox registration and include it in durable job/outbox context before scheduling conversation work. Retries keep that identity, irrespective of later credential edits or dashboard selection. Scope delivery-status updates by both organization and provider message ID; statuses never produce a bot reply.
- Invalid signatures/challenges fail before ingestion. Unknown or mismatched provider mappings never create tenant work. For a valid root batch, acknowledge and skip permanently unroutable changes with sanitized operational diagnostics while processing valid changes independently. Archived organizations accept no new booking/message work; matching status updates may reconcile prior deliveries. Database or configuration-store outages return a retryable failure, with deduplication protecting changes already registered.
- Outbound messages, media downloads/uploads, and delivery retries resolve the queued organization's own phone/WABA IDs and effective access token on the server. Jobs carry organization IDs and provider identifiers, never decrypted credentials. Technician notification templates follow the conditional inheritance rules above. OpenAI calls, image-preview limits, model selection, pricing estimates, timezone, business defaults, salon configuration, and simulator enablement use that same organization context.

### Callback URLs on Vercel

- Build callback URLs on the server from the configured `APP_URL`, using the URL API. When `VERCEL_AUTOMATION_BYPASS_SECRET` is nonempty, set the query parameter `x-vercel-protection-bypass` to that value for both root and organization URLs. URL-encode the value and preserve existing query parameters. Do not use an untrusted request host to construct a callback.
- The displayed and copied URLs include the bypass value. Returning these complete URLs through authorized dashboard APIs and displaying them to system administrators or assigned organization administrators is explicitly allowed. This exception does not grant access to root Meta credentials.
- Examples below use placeholders only; real values must never be committed:

  ```text
  https://{app-domain}/api/whatsapp/webhook?x-vercel-protection-bypass={encoded-bypass-value}
  https://{app-domain}/api/whatsapp/webhook/{organizationId}?x-vercel-protection-bypass={encoded-bypass-value}
  ```

- With no bypass environment value, omit the parameter. Show whether the bypass value is configured and explain that a protected deployment requires it; absence of the value must not imply deployment protection is disabled. Keep the variable server-only, without a `NEXT_PUBLIC_` prefix, and document it in `.env.example`, the configuration reference, and the Vercel deployment guide when implementing this change.
- Configure Meta with the full URL so both GET challenges and POST deliveries pass Vercel protection. Meta's `hub.*` query parameters must coexist with the bypass parameter. Vercel bypass does not replace Meta verification or grant access to JWT-protected admin APIs. Rotating the environment secret requires a deployment and updating affected callback URLs in Meta.

### Credential storage and dashboard access

- Encrypt root Meta credentials and organization provider credentials at rest using a server-only platform encryption key or managed key service. Root settings and their platform audit records are explicitly platform-scoped; tenant settings and their audit records remain organization-scoped. The browser never accesses credential tables directly.
- Authorized settings APIs may return decrypted **Meta** values for editing: only system administrators may read/write root values; system administrators and assigned organization administrators may read/write an organization's saved overrides. Use password inputs with hide/show controls for access tokens, app secrets, and verify tokens. Hiding an input is presentation; route-handler authorization enforces access.
- Every settings API calls `requireApiAdmin`, validates the authenticated Supabase JWT/session, then rechecks the current system role or active organization membership before using the service-role client. A valid JWT alone does not grant root access or access to another organization's overrides. Organization responses contain only saved overrides and inheritance/health metadata, never resolved root secrets. Root values are retrieved only through the separate system-only API.
- Credential and callback-URL responses use `Cache-Control: private, no-store`; shared SWR keys include the session and authorized scope. Clear sensitive client cache/form state on sign-out, scope changes, or lost authorization, and never persist it to browser storage. Do not include credentials, verify-token query values, or complete bypass-bearing URLs in application logs, exports, audit details, job payloads, error messages, analytics, or AI prompts.
- Audit credential changes, override clearing, organization activation, and administrator membership changes using actor, scope, time, and changed field names, without secret values. Keep the existing no-browser-disclosure rule for OpenAI keys, Supabase service-role keys, Inngest secrets, and encryption material; the display exception covers Meta settings and the generated Vercel callback URLs only.

Platform-wide infrastructure remains environment configuration: Supabase credentials, Inngest credentials, application URL/environment, `VERCEL_AUTOMATION_BYPASS_SECRET`, server-side encryption material, and global feature flags. Root Meta settings are editable database configuration, not permanent environment-only settings.

Existing environment values cannot be copied into the database by a SQL migration. A one-time server-side bootstrap/import transfers the existing Meta access token, app secret, and webhook verify token into encrypted **root** settings; the WABA ID, receiving phone-number ID, and OpenAI configuration go into the default organization's settings. Leave that organization's Meta overrides null so it inherits root settings and keeps the existing root callback. Make the import rerunnable without overwriting later administrator edits, and validate configuration before removing the old environment-based runtime path.

The existing technician template names already live in the singleton `platform_settings` database row. Backfill those names into root notification defaults and leave the default organization's template overrides null, preserving existing notification behavior through inheritance. These non-secret database values can be copied by the additive migration; they do not come from environment variables. Preserve intentionally empty template names and never overwrite subsequent administrator edits on an import retry.

## Account and authorization model

The current single admin account becomes a system-role account. System-role accounts are platform operators and are not limited to one organization.

### System administrators

- A system administrator can create organizations, activate/deactivate them, select any organization, and manage organization memberships.
- Only a system administrator can access the root Meta settings page/API and read, edit, or reveal saved root Meta credentials, and manage root technician notification-template defaults. System administrators can also manage any organization's saved Meta and notification-template overrides.
- Only a system administrator may create an account, set its real initial password directly, reset a password, remove an account, or change an account's system role. Account creation and password reset do not rely on email invitations or password-setup links.
- System administrators can create organization-admin accounts and assign each one to one or more organizations.
- System administrators may manage their own profile but account lifecycle actions must remain protected from accidental loss of the final system administrator.

### Organization administrators

- An organization administrator can access only organizations to which they have an active membership.
- They can manage all operational data, WhatsApp/OpenAI configuration, and settings of their assigned organizations. More granular organization roles may be introduced later, but are out of scope for this update. They cannot create accounts, reset passwords, remove accounts, grant system roles, or change membership outside their own authorized organization scope.
- They may reveal and edit their organization's saved Meta override bundle, edit its notification-template names, view inheritance/health state, and copy its selected callback URL including the Vercel bypass query value. They cannot read or edit root Meta settings, including the values inherited when their override bundle is absent. A system administrator completes shared-root Meta setup steps requiring the root verify token; the organization API does not disclose it to make setup easier.
- A user may be an organization administrator for one or many organizations. Their active organization is selected in the dashboard, and every browser request rechecks that membership server-side.

### WhatsApp staff

- Business owners and technicians remain WhatsApp-only roles. Their stored WhatsApp mappings are organization-scoped and never grant browser-dashboard access.
- WhatsApp role resolution, tool authorization, bookings, notifications, and staff summaries always use the organization determined at ingress.

## Dashboard experience

- The protected admin root page displays the signed-in user's available active organizations in a paginated table. System administrators see every organization; organization administrators see only their active memberships. Each row opens that organization's scoped dashboard.
- System administrators have an Archived organizations filter on the root organization table. They can inspect archived organizations and recover them; organization administrators cannot view, archive, or recover archived organizations.
- For system administrators, the root page also displays a paginated account table. It supports creating an account, assigning it to one or more organizations during creation, and resetting an administrator account's password. Password reset remains unavailable to organization administrators and is handled without displaying the current or new password in tables, logs, or audit details.
- Add a **Root Meta settings** page linked from the root dashboard and visible only to system administrators. It loads and saves the root access token, app secret, and webhook verify token through a system-only authenticated API, displays saved values in password inputs with hide/show controls, and shows the complete root callback URL plus configuration health and shared-app setup instructions. Include the optional root confirmed/cancelled technician template names and the template setup guide with filled message examples described below.
- Add an organization switcher for system administrators and multi-organization administrators. The current organization must be clearly visible on every organization-scoped page.
- Add a system-only organization-management area for creating organizations by name, assigning administrators, viewing configuration health, and archiving/recovering organizations. WABA/phone settings are optional at creation. Each organization needs its own unique WABA and receiving-phone mapping before real WhatsApp use; it may inherit root Meta credentials or provide a complete override bundle for the same or a different app.
- In each authorized organization's settings, show its WABA ID and receiving-phone-number ID plus a Use root Meta settings or Override Meta settings choice. Override mode requires the access token, app secret, and webhook verify token together. Load only the saved organization bundle into password inputs with hide/show controls; root mode leaves all three empty and labels them as inherited. Switching back to root mode clears the complete saved bundle when submitted. Never populate these inputs with root credentials, including when a system administrator opens an organization page.
- Display the callback selected from the saved configuration: root URL when the override bundle is absent, organization URL when a complete bundle is saved, including the Vercel bypass parameter when configured. A partially completed form cannot save or change the active callback. Saving or clearing the bundle refreshes the URL and Meta setup checklist. Show the selected source, whether effective configuration is ready, and whether a system administrator must complete shared-root verification. Root changes refresh inherited health without exposing the new root values.
- Add optional confirmed/cancelled technician template fields to organization settings, showing Root, Organization, or No template for each notification type. With a Meta override, empty fields must show No template and explain that root templates are not used. With root Meta settings, empty fields show whether a root default is available. The same template setup guide and filled message examples appear here; editing notification templates alone never switches the Meta credential source or callback URL.
- Each organization has an Accounts page listing all accounts assigned to that organization in a paginated table. Assigned organization administrators can view the list, but only system administrators see the action to create a new administrator already assigned to that organization.
- Add a system-only account-management area for creating accounts, assigning/removing organization memberships, resetting passwords, changing permitted roles, and removing accounts.
- Existing business, salon, service, technician, settings, inbox, simulator, analytics, and export screens operate only in the selected authorized organization context.
- Browser-supplied organization IDs are only selectors; route handlers independently verify the signed-in user's system role or active organization membership before using them.

### Technician template setup guide and message examples

Improve the existing guide in `src/components/admin/settings-client.tsx`, and reuse it on root and organization settings pages. For both confirmed and cancelled templates, show the exact body with `{{1}}` through `{{5}}` for entry in Meta WhatsApp Manager, followed by a clearly labelled **Example message** with every placeholder replaced by fictional sample values. Keep the copyable template body separate from the filled preview so administrators can copy the correct text into Meta. The guide's UI remains English; approved template bodies retain their configured language, and an English sample must be labelled as such when setup uses another language.

Preserve the existing parameter order and show the same example values in the placeholder explanation and the rendered preview:

| Placeholder | Meaning                         | Example value                        |
| ----------- | ------------------------------- | ------------------------------------ |
| `{{1}}`     | Salon name                      | Studio Lumiere                       |
| `{{2}}`     | Customer name                   | Lena Fischer                         |
| `{{3}}`     | Customer WhatsApp number        | 447700900123                         |
| `{{4}}`     | Local appointment date and time | 2026-09-25 14:30                     |
| `{{5}}`     | Booking reference               | 550e8400-e29b-41d4-a716-446655440000 |

Confirmed template body:

```text
New booking at {{1}}. Customer: {{2}} ({{3}}). Appointment: {{4}}. Booking reference: {{5}}.
```

Example confirmed message:

```text
New booking at Studio Lumiere. Customer: Lena Fischer (447700900123). Appointment: 2026-09-25 14:30. Booking reference: 550e8400-e29b-41d4-a716-446655440000.
```

Cancelled template body:

```text
Booking cancelled at {{1}}. Customer: {{2}} ({{3}}). Appointment: {{4}}. Booking reference: {{5}}.
```

Example cancelled message:

```text
Booking cancelled at Studio Lumiere. Customer: Lena Fischer (447700900123). Appointment: 2026-09-25 14:30. Booking reference: 550e8400-e29b-41d4-a716-446655440000.
```

- Render previews locally from the same template bodies and one ordered sample-value list, so placeholders, examples, and the runtime parameter contract stay aligned. Use a readable message preview with wrapping for long booking references. These are illustrative messages, not live customer data or proof of Meta approval; rendering a guide must not call AI or send WhatsApp messages.
- The checklist must identify the organization's own WABA, enter the body and matching example values in Meta's template editor, select the intended approved language, complete approval, and save the exact approved name in the applicable root or organization setting. Explain that root defaults still need approval in each receiving organization's WABA. Retain the explanation of the 24-hour window and use `[N/A]` for missing details; date/time examples and actual notification parameters have no timezone suffix.

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
3. Update foreign keys, indexes, uniqueness constraints, RLS policies, and database functions so organization scope is mandatory and enforced in SQL. Enforce globally unique organization WABA IDs and receiving phone-number IDs, plus tenant-scoped event and delivery-status idempotency.
4. Backfill all existing rows into the default organization while preserving booking references, timestamps, historical snapshots, and message/provider identifiers.
5. Add encrypted root Meta settings, encrypted organization provider settings, and nullable Meta override bundles with an all-null or all-present database constraint. Add optional root and organization confirmed/cancelled template names independently of that constraint. Backfill existing singleton template names into root defaults, leaving default-organization template overrides null. Run the one-time server-side import: Meta credentials to root, WABA/phone and OpenAI configuration to the default organization, with its Meta overrides left null.
6. Implement one server-side effective-Meta resolver, the conditional technician-template resolver, and a callback-URL builder. Extend webhook normalization with receiving phone/WABA metadata, keep the root route, and add the organization route with scoped verification/registration. Change background jobs, provider adapters, conversation tools, admin APIs, reporting, and simulator flows to propagate and enforce organization context. Apply the template resolver to every booking-notification path, preserving queued payloads on retries.
7. Add the system-only root Meta settings API/page and organization override APIs/forms, including optional notification-template settings and the shared setup guide with filled message previews. Enforce the separate credential-read permissions and include the Vercel bypass value in generated callback URLs. Configure/verify each Meta subscription before directing live traffic to a new callback. Report approval status for any configured templates in that organization's WABA separately from webhook readiness; missing optional templates do not block rollout.
8. Remove tenant singleton constraints and old provider environment runtime reads only after the organization-scoped path is verified and operating. Preserve the intentional singleton root Meta settings record and keep the root webhook as a permanent supported endpoint.
9. Regenerate database types after schema changes and validate the transition with representative default-organization data, another organization inheriting the same root app with a different WABA, and an organization overriding credentials for a separate app.

## Safety and acceptance principles

- No query, RPC, API, job, cache key, idempotency key, queue row, export, or provider request may cross organization boundaries.
- A retry must continue under the organization captured at original ingestion/queueing time, even if the user's active dashboard selection later changes.
- Sharing a Meta app or token never permits sharing a WABA/receiving-phone mapping or accessing another organization's data. Both webhook routes verify signatures and provider mappings before creating tenant work.
- Root notification-template fallback is allowed only when the organization uses root Meta credentials. An organization with its own Meta override and an empty notification-template setting has no template for that event type; it remains validly configured for WhatsApp.
- Root secrets are readable only through the system-only settings API. An organization administrator sees only their authorized organizations' saved Meta overrides, source/health metadata, and generated callback URLs, including the explicitly permitted Vercel bypass value.
- Simulator enablement is evaluated against the organization captured by the event or booking; switching another organization's setting must not affect it. New simulator bookings are distinguishable from real bookings throughout their lifecycle.
- Only system administrators manage user accounts and passwords. Organization membership does not grant account-administration authority.
- Deleting/removing an account must revoke access and preserve audit/history records according to retention requirements; it must not silently reassign ownership or erase organization data.
- The platform must retain at least one active system administrator at all times.
- Existing image-byte privacy, service-role secrecy, WhatsApp signature verification, staff-mapping verification, and idempotent booking/message behavior remain unchanged.

### Required application acceptance coverage

- Name-only organization creation and the default-organization seed work without Meta credentials or WABA/phone IDs. Enabling real WhatsApp is rejected until unique organization identifiers and a complete selected credential bundle are configured. This readiness gate does not prevent dashboard setup or independently authorized simulation.
- Two organizations with different WABA/phone IDs and no overrides use the same root credentials and displayed root URL. Batched root messages and delivery statuses route independently to the correct organizations; the same customer WA ID cannot join their histories or permissions.
- All three Meta fields must be overridden together. One or two provided fields, mixed blank/nonblank fields, and attempts to clear only part of a saved bundle are rejected atomically. Omitting the entire bundle preserves it; explicitly clearing all three fields restores root inheritance. A complete saved bundle selects the organization URL; clearing it selects the root URL. Root rotation affects only organizations using root settings. Invalid explicit overrides fail without silently falling back.
- For confirmed and cancelled notifications independently, cover all four template-selection cases above, missing root defaults, explicit clearing, switching Meta modes, and root-default edits. An organization Meta override with no templates is accepted and produces the existing ordinary notification path, never a root template. Overriding a template while using root Meta credentials leaves the webhook unchanged. Cover rescheduling/reassignment, duplicate queueing, retries retaining their original payloads after settings changes, and simulator isolation.
- Root template defaults are editable only by system administrators; organization template settings enforce active membership. The default-organization backfill preserves existing effective names, including nulls. Validate actual template approval in each WABA during manual provider setup; sharing a Meta app never implies shared approval.
- Root and organization guide previews show both confirmed and cancelled bodies with all five fictional sample values substituted in the correct order, while the copyable Meta bodies retain their numbered placeholders. Missing details use `[N/A]`, timestamps have no timezone suffix, and previews make no provider/AI calls. The UI distinguishes inherited templates from No template in organization Meta mode, without blocking save/WhatsApp enablement when optional templates are absent.
- A separately configured app verifies its GET challenge and POST signature at the organization URL. Wrong signatures, a wrong path organization, mismatched WABA/phone IDs, missing routing metadata, and unknown or archived organizations cannot create new tenant work. A root-signed payload cannot enter an organization whose effective app secret is different.
- Receiving the same provider event through both authorized routes produces one inbox/booking/reply effect. Root batches isolate unroutable changes; transient storage failures remain retryable. Status callbacks can update only the matched organization's outbound message.
- A missing selected credential bundle or settings-store outage fails safely. An organization with a complete override can verify, receive, and send through its own route without configured root Meta values. Duplicate WABA/phone assignments are rejected by the settings API, with database uniqueness as defense in depth. Use application tests and manual schema verification, not automated migration tests.
- System administrators can read, reveal, save, and rotate root Meta values. Organization administrators cannot read/write the root API or another organization's override API, including by forged IDs. Their own override responses contain saved values and nulls for inheritance, never root credentials. Password inputs support hide/show; switching organization or signing out clears sensitive form/cache state.
- Both callback forms encode `VERCEL_AUTOMATION_BYPASS_SECRET` correctly, preserve Meta challenge query parameters, omit the bypass parameter when unset, and return complete URLs only to authorized dashboard users. A bypass query value cannot bypass dashboard JWT/role checks or Meta signature verification.
- Perform a manual dev-provider check of both GET and POST callbacks behind Vercel deployment protection, a shared-app per-WABA callback override, and a separate-app callback. Verify subscription changes and inherited-token setup by a system administrator. These are rollout checks; do not claim that application tests prove live provider setup.

## Documentation and rollout updates

As implementation begins, update single-business assumptions in `AGENTS.md`, product requirements, architecture overview, data model, authorization model, WhatsApp integration, configuration reference, admin UI documentation, and implementation status, clearly distinguishing planned work from completed behavior. Supersede ADR 0001 with a new ADR covering the multi-organization boundary, distinct WABA/phone ownership, shared or overridden Meta credentials, both webhook routes, credential storage and authorized disclosure, and system-administrator authority. Update the account-lifecycle documentation associated with ADR 0009.

Update TECH-01 acceptance, notification conversation flows, WhatsApp template setup, configuration/admin UI documentation, and implementation status together with conditional root-template inheritance and filled message previews. Keep the five-placeholder contract, approved-language behavior, per-WABA approval instructions, optional-template behavior, and confirmation/cancellation examples synchronized.

Keep `.env.example`, `docs/development/configuration.md`, and the deployment/runbook instructions synchronized. Add `VERCEL_AUTOMATION_BYPASS_SECRET` as an optional server environment value, explain the complete callback URLs and rotation steps, and distinguish the bootstrap-only legacy Meta environment values from the editable root settings. Replace existing documentation that universally forbids saved Meta values in the dashboard with the role-specific disclosure rules above.

Stage rollout across compatible releases: introduce the schema and default organization, import/validate root credentials and default-organization mappings, add settings pages and both verified webhook routes, switch runtime traffic to organization-scoped processing, validate shared-app and separate-app organizations, then remove deprecated environment values such as `NEXT_PUBLIC_WHATSAPP_NUMBER` and singleton tenant behavior. The existing root callback remains supported. Run `pnpm install` and `pnpm check` with Node.js 22 and pnpm 12.4.1; after applying schema changes, run `pnpm db:types`. Do not add automated Supabase migration tests or migration-test CI jobs, and do not reset local data unless intentionally rebuilding it.
