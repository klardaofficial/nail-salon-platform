# Authorization

## Dashboard accounts

Supabase Auth stores credentials. `platform_admins` is the account profile and `organization_admin_memberships` grants active tenant access. `requireSystemAdmin` protects organization lifecycle, account lifecycle, and root system settings (Meta credentials and OpenAI key/models/pricing). `requireOrganizationAdmin(organizationId)` validates the path UUID, then trusts only the stored system role or active membership; archived organizations allow explicit read-only access and reject mutations. All handlers reauthorize before using the service-role client and explicitly filter by organization because service role bypasses RLS.

The initial confirmed system account must change its password. System administrators create confirmed accounts with supplied initial passwords, reset passwords, assign memberships/system role, and soft-remove accounts. Initial/reset passwords set `must_change_password`. Remove deactivates the profile, revokes memberships, and bans Auth without deleting identity/audit history. Locked SQL rejects removing or demoting the final active system administrator.

RLS mirrors system/membership scope as defense in depth. Credential tables are server-only. Organization settings responses may return that organization's saved Meta override to an authorized editor, never inherited root secrets. OpenAI keys are write-only from an organization editor's perspective: only whether an override is configured and its effective source (root or organization) are returned, never a raw key from either scope. The root system settings page, protected by `requireSystemAdmin`, returns the root OpenAI key and Meta secrets directly.

## WhatsApp actors

The webhook fixes organization scope from signed receiving WABA/phone metadata before resolving a contact. Contacts, owner mappings, and technician mappings are organization-specific. Text claims never grant roles. Every customer, owner, and technician tool receives trusted organization/business/contact context and rechecks all submitted entity IDs and mappings; scoped SQL functions enforce the same boundary.

Simulator APIs require an active organization membership and that organization's simulator setting. Synthetic ingress is registered directly as verified simulator context. It cannot set real webhook scope, and simulated delivery never calls Meta.

## Public booking-intent endpoint

`GET /api/public/{organizationId}/booking-intent` is the app's first deliberately unauthenticated route: it exists so a customer's own browser, redirected there by a separate external booking website, can be handed straight to WhatsApp with no login step in between. This is an accepted tradeoff, not an oversight — see `docs/product/requirements.md` BOOK-07 for the intended flow. There is no session or signature to check; the only control is the readiness gate already used by `qr/route.ts` and `settings/route.ts` (`resolveEffectiveMetaConfiguration(...).readiness === "enabled"`), which folds in `organizations.status !== 'active'`.

The `booking_intents.code` column is a per-organization bearer token, not an identity credential: holding it is sufficient to claim the intent it names, in whatever conversation the holder sends it from, but it carries no customer identity and claiming one seeds a draft, never a confirmed booking, in the claimer's own conversation. Impact of a leaked or guessed code is kept low by a CSPRNG-generated code (13 characters over a 32-symbol alphabet), a 4-hour expiry, single-use atomic claiming, and storing no customer-identifying data on the intent row itself. Any error while building or redeeming an intent degrades to a plain `wa.me` link with a language-neutral prefill rather than surfacing an authenticated-style JSON error, so the customer always reaches the bot; a JSON error is returned only when the organization has no validated WhatsApp destination to redirect to at all.
