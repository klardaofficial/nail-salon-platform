# ADR 0005: No persistent image storage

Status: Accepted, 2026-09-15.

Customer and generated image bytes exist only in memory during one download, edit, and upload step. PostgreSQL and job results keep WhatsApp media IDs plus bounded metadata. No Supabase Storage bucket or temporary filesystem path is used.

Persistent galleries/base64 columns were rejected by requirement. The consequence is that expired/unavailable source media cannot be reconstructed; the customer must resend. WhatsApp and OpenAI retain data under their own policies.

Affected modules: preview tables/RPCs, preview processor, WhatsApp media adapter, tests and runbooks.
