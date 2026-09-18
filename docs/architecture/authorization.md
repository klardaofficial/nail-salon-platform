# Authorization

## Dashboard accounts

Supabase Auth stores credentials. `platform_admins` is the account profile and `organization_admin_memberships` grants active tenant access. `requireSystemAdmin` protects organization lifecycle, account lifecycle, and root system settings (Meta credentials and OpenAI key/models/pricing). `requireOrganizationAdmin(organizationId)` validates the path UUID, then trusts only the stored system role or active membership; archived organizations allow explicit read-only access and reject mutations. All handlers reauthorize before using the service-role client and explicitly filter by organization because service role bypasses RLS.

The initial confirmed system account must change its password. System administrators create confirmed accounts with supplied initial passwords, reset passwords, assign memberships/system role, and soft-remove accounts. Initial/reset passwords set `must_change_password`. Remove deactivates the profile, revokes memberships, and bans Auth without deleting identity/audit history. Locked SQL rejects removing or demoting the final active system administrator.

RLS mirrors system/membership scope as defense in depth. Credential tables are server-only. Organization settings responses may return that organization's saved Meta override to an authorized editor, never inherited root secrets. OpenAI keys are write-only from an organization editor's perspective: only whether an override is configured and its effective source (root or organization) are returned, never a raw key from either scope. The root system settings page, protected by `requireSystemAdmin`, returns the root OpenAI key and Meta secrets directly.

## WhatsApp actors

The webhook fixes organization scope from signed receiving WABA/phone metadata before resolving a contact. Contacts, owner mappings, and technician mappings are organization-specific. Text claims never grant roles. Every customer, owner, and technician tool receives trusted organization/business/contact context and rechecks all submitted entity IDs and mappings; scoped SQL functions enforce the same boundary.

Simulator APIs require an active organization membership and that organization's simulator setting. Synthetic ingress is registered directly as verified simulator context. It cannot set real webhook scope, and simulated delivery never calls Meta.
