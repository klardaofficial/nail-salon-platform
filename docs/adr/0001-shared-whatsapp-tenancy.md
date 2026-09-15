# ADR 0001: One WhatsApp Business Account and one business

Status: Accepted (revised), 2026-09-15.

All active salons appear through one WhatsApp Business Account and its one phone number. A deployment supports one business, enforced by the database. Contacts are WhatsApp identities; internal business IDs retain relational and historical integrity but are not tenant boundaries. Owner authority comes from the configured business's `business_owners` mappings, and technician authority comes from matching active technician records.

This keeps customer entry simple and supports cross-salon quotas/retention without multi-tenant selection or filtering. Separate phone numbers per salon, multiple independent businesses, and text-claimed roles were rejected because they fragment discovery, add unsupported tenancy, or cannot authorize access.

Affected modules: webhook normalization, conversation actor resolution, booking/catalog tables, admin business/owner screens, and reporting.
