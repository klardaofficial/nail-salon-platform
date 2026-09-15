# ADR 0001: Shared WhatsApp number and tenancy

Status: Accepted, 2026-09-15.

All active salons appear through one platform WhatsApp number. Contacts are platform identities; businesses and salons own operational records through explicit IDs. Owner authority comes from `business_owners`, and technician authority comes from matching active technician records.

This keeps customer entry simple and supports cross-salon platform quotas/retention while requiring every tool/query to scope business data. Separate phone numbers per salon and text-claimed roles were rejected because they fragment discovery or cannot authorize access.

Affected modules: webhook normalization, conversation actor resolution, booking/catalog tables, RLS, admin business/owner screens.
