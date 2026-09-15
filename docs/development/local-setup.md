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

The migrations create the required platform setting and initial administrator (`admin@gmail.com` / `Pass1234`) but no salons, services, technicians, customers, bookings, or conversations. The admin UI requires a password change at first login. Use `pnpm db:reset` only when you intentionally want to erase local data and rebuild this same migration-only state.

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

If Docker is unavailable, the embedded PGlite test still validates migration execution, but it does not replace `pnpm db:reset` and `supabase db lint` on a full local stack.
