# Local setup

Install Node.js 22, pnpm 12.4.1, Docker Desktop, and Git. Then:

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm db:start
pnpm exec supabase status
pnpm db:types
pnpm dev
```

`pnpm db:start` starts the local Supabase stack and applies the migrations when the database is created. Copy the values printed by `pnpm exec supabase status` into `.env.local` using this mapping:

| Supabase status output         | Application variable                   |
| ------------------------------ | -------------------------------------- |
| API URL                        | `NEXT_PUBLIC_SUPABASE_URL`             |
| Publishable key or anon key    | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key or service_role key | `SUPABASE_SERVICE_ROLE_KEY`            |

The publishable/anon key may be used by the browser. The secret/service-role key bypasses RLS and must remain server-only. Do not copy either value from a hosted project into local development.

`pnpm db:types` writes its output only after successful generation. It first uses the local CLI, then can use the already-running local Supabase metadata service when Docker management is unavailable. That fallback requires a loopback `NEXT_PUBLIC_SUPABASE_URL` and its local service-role key from `.env.local`; it never falls back to a hosted project. Apply pending migrations with `pnpm db:migration` before generating types. No reset is needed for an additive migration.

The migrations create the required platform setting, editable singleton business profile (`Nail Salon`), and initial administrator (`admin@gmail.com` / `Pass1234`) but no salons, services, technicians, customers, bookings, or conversations. The admin UI requires a password change at first login. Edit the business profile before adding salon locations. Use `pnpm db:reset` only when you intentionally want to erase local data and rebuild this same migration-only state.

## Local Inngest

Keep `INNGEST_DEV=1` in `.env.local` and leave `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` empty. Local mode sends events to the dev server at `http://localhost:8288`; no Inngest account is required.

After Supabase is running and `.env.local` contains its keys, use two terminals:

```powershell
# Terminal 1: Next.js application and function endpoint
pnpm dev

# Terminal 2: Inngest dev server
pnpm inngest:dev
```

Open `http://localhost:8288`. The app `nail-salon-platform` should show these four functions: `process-whatsapp-event`, `deliver-whatsapp-message`, `generate-style-preview`, and `recover-durable-outboxes`. The CLI registers them from `http://localhost:3000/api/inngest` and runs the recovery cron locally.

Start Next.js first. If the dashboard shows zero functions, confirm `http://localhost:3000/api/inngest` responds, then restart `pnpm inngest:dev`. Function execution needs the local Supabase service-role key. WhatsApp and image flows additionally need their provider credentials; basic registration does not.

## Browser WhatsApp simulator

No Meta account, phone, or public tunnel is needed for simulated chats. Keep the local Supabase values configured and add these values to `.env.local`:

```dotenv
WHATSAPP_SIMULATOR_ENABLED=1
INNGEST_DEV=1
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
OPENAI_API_KEY=your-openai-api-key
```

For simulation alone, leave `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` empty. Approved technician template names are optional and are configured in **Admin | Settings**, not environment variables. WhatsApp Graph API requests are hard-coded to `v26.0`. `NEXT_PUBLIC_WHATSAPP_NUMBER` only controls the marketing link and is not needed by the simulator. Without an OpenAI key, initial greetings, interactive welcome controls, and fallback replies still work; natural conversations and booking/management tools require it.

Restart `pnpm dev` after changing environment values, run `pnpm inngest:dev` in a second terminal, and sign in at `http://localhost:3000/admin`. Complete the initial password change if prompted, then open **WhatsApp simulator** (`/admin/simulator`).

- Add customers with a name and `wa_id` (5–32 digits, country code included, no plus or spaces). Each has an independent chat window. Customer windows are saved in this browser; removing one does not delete contact data, bookings, or history. Re-add the same ID to reopen its conversation.
- Owners load from the configured business's owner mappings. Technicians load from active, non-deleted technician records. Configure these through Business and Technicians; refresh identities or wait for the ten-second refresh. Multiple mappings for the same WA ID share one window and show both roles when applicable.
- Send text or click a delivered reply button/list option. Conversation windows poll every two seconds and display queued, processing, failed, and simulated-delivery states. A queued message that stays queued usually means Inngest is not running or synced; inspect `http://localhost:8288`.
- Create an active salon to test bookings. Services and technicians remain optional. A simulated booking assigned to a technician produces its notification in that technician's simulator window, even before they have sent a message.

Simulated and real WhatsApp use separate conversation histories/drafts but share the configured business and booking database. Simulated actions therefore really create/cancel bookings or change business records. Simulated replies and notifications never go to Meta. Real WhatsApp traffic continues through the normal provider path. Image upload/preview generation and Meta-specific delivery behavior are outside this text/interactive simulator.

Set `WHATSAPP_SIMULATOR_ENABLED=0` and restart to hide the page and disable its API. Already queued simulated outbound messages remain captured, and pending simulated inbound work pauses until re-enabled.

For a hosted development deployment, set the same simulator flag and use that environment's Supabase/OpenAI credentials. Configure cloud Inngest (`INNGEST_DEV=0`, event key, signing key, and synced `/api/inngest` functions), then redeploy. Meta credentials are only required if that deployment also handles real WhatsApp traffic.

## WebStorm and Prettier

The repository includes `.prettierrc.json`, `.prettierignore`, `.editorconfig`, and an ESLint flat config compatible with Prettier.

In WebStorm, open **Settings | Languages & Frameworks | JavaScript | Prettier**, choose **Automatic Prettier configuration**, enable **Run on save**, and use `node_modules/prettier`. Keep EditorConfig support enabled. Use `pnpm format` for the same result in CI and `pnpm format:check` to verify without changing files. `.idea` is intentionally ignored so each developer keeps personal IDE settings.

Useful commands:

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm check
pnpm whatsapp:simulate 4915112345678 "Hallo"
```

The application tests do not start Supabase or execute migration SQL. Docker is needed when running the local Supabase stack, not for `pnpm check`.
