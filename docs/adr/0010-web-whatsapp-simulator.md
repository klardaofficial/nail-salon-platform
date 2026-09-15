# ADR 0010: Admin web simulator alongside real WhatsApp

Status: Accepted, 2026-09-15.

`WHATSAPP_SIMULATOR_ENABLED=1` exposes an authenticated admin testing UI and APIs locally or when hosted. It does not switch the deployment's real WhatsApp transport. The admin may create named customer windows or select stored owner/technician identities; chat text never grants a role.

The simulator constructs an internally signed webhook and uses the shared signature verification, normalization, durable inbox registration, Inngest jobs, and conversation tools. Only this authenticated entry point supplies the trusted simulated-event marker. The public Meta endpoint still checks its configured app secret.

Existing `conversations.channel` separates `whatsapp_simulator` history/drafts from `whatsapp`. Contacts, role mappings, catalog, and booking data are shared to exercise actual domain behavior. The source transport travels explicitly into reply and notification queues and is stored in the existing outbox JSON payload, so retries after restart/configuration changes cannot send simulated output through Meta. No schema migration is required.

Mocking replies in the browser would skip authorization and domain logic. A deployment-wide provider replacement would prevent concurrent real-device testing. Process-memory routing flags would be lost between durable job executions. The chosen design changes only the testing ingress and delivery boundaries.

The simulator supports text and interactive messages, not image uploads or Meta delivery-window/template validation. It also runs the shared outgoing provider payload builder, so formatting and button/list bounds are exercised before capture. Disabling its flag hides the UI, rejects its APIs, pauses pending simulated inbound jobs, and leaves durable simulated output routed to capture.

Affected modules: simulator admin components/API, conversation event processing/tools, shared messaging ingress/outbox, environment configuration.
