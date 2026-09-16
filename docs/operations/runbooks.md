# Operations runbooks

## Webhook rejected or silent

Check Meta callback URL, GET verify token, app secret, Graph version, and 2xx rate. A 401 means HMAC mismatch. Inspect sanitized inbox counts and provider event IDs; never log the full token or image body. Replay the exact provider event only through Meta or a synthetic fixture because deduplication is expected.

## Delayed or failed jobs/messages

Inspect `job_outbox` and `message_outbox` state, attempts, available time, and bounded error code. Inngest's two-minute recovery redispatches pending/failed rows. Verify `/api/inngest` signing key and function sync. Delivery retries reuse the saved WhatsApp media ID.

For a silent local simulator, check that `http://localhost:3000/api/inngest` reports four functions and `http://localhost:8288` is reachable. Trace the simulated inbox event through its job, AI usage and event-specific reply outbox row. An inbound history row with no AI usage or reply can indicate a context query failure before OpenAI. The salon interval column is `booking_interval_minutes`, while platform settings use `default_booking_interval_minutes`; selecting the platform column from salons fails even when no salons exist.

After fixing a processing error, retry the original unfinished event through Inngest. If an older faulty retry already marked it processed without a reply, first verify the source, message, existing reply key and any tool side effects. Reopen only the affected local test event and redispatch its original inbox/job IDs. Do not delete history, reset the database, or blindly replay booking requests.

## Duplicate behavior

Compare unique provider event/message IDs, conversation/tool call IDs, and booking idempotency key. Do not delete unique constraints. A duplicate webhook returning 200 with no new work is normal.

## Technician notification failure

Check recipient WA ID and service window. Outside the window, create the approved confirmed/cancelled Meta templates shown in **Admin | Settings** and save their exact names there. Missing/unreachable technicians must not alter the customer booking.

## Image unavailable or quota mismatch

WhatsApp media URLs expire; ask the customer to resend when download fails. Never reconstruct pixels from the stored text summary. Stale reserved/processing previews are released after 30 minutes. Reconcile `preview_usage` against terminal preview rows before manual correction and record an audit/incident note.

## OpenAI error

Confirm key, project limits, configured model availability, SDK status, and request size. Retry transient jobs through Inngest. Do not switch the bot language dynamically or expose raw provider errors to customers.

## Initial admin and password recovery

After a fresh migration, sign in as `admin@gmail.com` / `Pass1234` and immediately complete the required Account settings password change. Verify the initial password then fails. For a lost password, use the protected Supabase Auth recovery/admin procedure and audit the action; do not recreate or reapply the initial migration.

## Database migration/recovery

Stop release promotion when migration fails. Keep the previous app serving compatible schema, diagnose with a fresh reset, and add a forward repair migration. Never edit an applied file. Restore only from a verified Supabase backup with documented recovery point and follow-up reconciliation.
