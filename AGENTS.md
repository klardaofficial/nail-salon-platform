# Coding agent entry point

Before changing code, read the relevant requirements in
`docs/product/requirements.md` and only the task-specific documents linked from
`docs/index.md`. Use the code and tests as the source of truth for current
implementation behavior.

Use Node.js 22 and pnpm 12.4.1. Run `pnpm install`, then `pnpm check` before handing off a completed change. For schema changes, regenerate types with `pnpm db:types` against the updated local database. Do not add or maintain automated Supabase migration tests or migration-test CI jobs. Use `pnpm db:reset` only when intentionally rebuilding local data. Never edit an applied migration; add a new timestamped migration.

## Module map

- `src/app/(marketing)`: fixed German public landing page.
- `src/app/admin`: fixed English Ant Design dashboard.
- `src/app/api/admin`: authenticated dashboard API consumed through SWR.
- `src/app/api/whatsapp`: verified WhatsApp webhook edge.
- `src/features/conversation`: context, prompts, scoped function tools, and event processing.
- `src/features/messaging`: durable outbound queue and delivery.
- `src/features/previews`: transient image edit/upload pipeline.
- `src/integrations`: provider adapters. Domain rules do not belong here.
- `src/inngest`: background jobs and recovery dispatcher.
- `supabase/migrations`: schema, RLS, and transactional functions.

## Product invariants

- One WhatsApp number serves every active salon. A customer chooses a salon when more than one is active. A sole active salon is selected implicitly.
- A booking needs an active business and future time. With no active salons, salon is null and platform timezone applies; a sole active salon is implicit and multiple active salons require a choice. Services, technician, duration, capacity, and attendance are optional. Bookings auto-confirm after clear customer agreement.
- One appointment may contain several services, custom Other text, and an additional request.
- `bookings.technician_ref` is deliberately nullable and has no foreign key. Preserve its snapshot behavior.
- Time off guides technician suggestions. It never blocks or cancels a booking.
- Cancellation is allowed only for the same customer and before `starts_at`.
- Owners and technicians use WhatsApp only. Their identity and business scope come from verified stored mappings, never their text claim.
- The admin interface is English and the landing page is German. Each organization selects a default language; AI replies and all WhatsApp option labels follow the person's conversation language. Verified staff start with role-specific capabilities.
- Browser dashboard reads and writes go through shared SWR fetchers and authenticated route handlers.
- Never write customer image bytes, base64 data, data URLs, or temporary image files to the database, logs, filesystem, job payloads, docs, or fixtures. Persist WhatsApp media IDs only.

## Authorization boundaries

The browser authenticates with Supabase Auth. Every admin API calls `requireApiAdmin`; server code then uses the service-role client. WhatsApp actions begin with a signature-verified event, resolve the contact's stored owner/technician mappings, and recheck scope inside each tool. RLS is enabled as defense in depth. Never expose the service-role key to client code.

## Change rules

Update the requirements, relevant task-specific document, and tests with a feature. A new tool must document its arguments, authorization, side effects, retry/idempotency behavior, and failures. A metric change updates chart, API, CSV, definition, and examples together. Keep `.env.example` and `docs/development/configuration.md` synchronized. Format through repository Prettier settings; do not commit WebStorm project files.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
