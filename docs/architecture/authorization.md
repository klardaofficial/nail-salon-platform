# Authorization

## Platform admin

Supabase Auth stores credentials. The initial migration inserts the one platform administrator as `admin@gmail.com` with password `Pass1234` and sets `platform_admins.must_change_password=true`. The protected admin shell redirects that account to Account settings and disables its other navigation until the password changes. `/api/admin/auth/password` verifies the current password, updates it through Supabase Auth, then clears the flag. This is a UI guard by requirement; admin APIs retain their normal authenticated-admin checks without an extra password-change query.

Protected layouts use `requireAdminIdentity`. Every `/api/admin` handler independently calls `requireApiAdmin`; only then does server code use the service-role client. The service role never enters browser bundles. RLS remains enabled as defense in depth.

## WhatsApp actors

The optional admin web simulator is an authenticated exception to the external Meta edge, not an owner/technician login surface. Every simulator API calls `requireApiAdmin` and checks the server-only enable flag. It creates an internally signed event, re-resolves staff mappings at send time, and invokes the same actor/tool scope checks as real WhatsApp. The public webhook cannot accept a browser-supplied simulated marker. Simulated histories are separate, but database actions use the same contacts and configured business records.

The webhook body must have a valid Meta HMAC before any identity is accepted. Its `from` WA ID resolves one platform contact. `business_owners` verifies membership in the configured business and active technician rows yield technician IDs. The model receives this bounded context, but every owner/technician tool rechecks the requested entity against stored mappings.

Customer list/cancel operations always filter by the current contact. Owner mutations load a salon and compare its `business_id` with the caller's stored membership. Technician booking queries, summaries and time off re-resolve active stored technician IDs using the actor's verified WhatsApp identity. Owner booking lists recheck business membership. The service-only `get_staff_booking_summary` RPC also rechecks stored mappings inside SQL, scopes every row and aggregates without pagination limits. The model cannot submit a contact ID, business ID or scope to these summary tools.

Text such as “I am the owner” never grants access. A model-generated ID, stale interactive value, or missing record fails before mutation. Tool execution results contain safe codes for a friendly reply and never expose service keys or raw database errors intentionally.
