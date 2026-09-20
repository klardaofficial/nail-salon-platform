# Nail Salon WhatsApp Platform

A multi-salon booking and nail-style engagement platform. Customers, owners, and technicians use one shared WhatsApp Business number. Platform administrators use a protected English dashboard; the public marketing page is fixed in German.

Implemented foundations include natural OpenAI Responses API conversations with validated tools, flexible auto-confirmed bookings, WhatsApp buttons/lists plus free text, transient OpenAI image previews, durable Inngest inbox/outbox jobs, Supabase migrations/RLS, analytics and CSV reporting, and a migration-created initial admin account.

For production setup, follow the **[Production deployment guide](docs/operations/deployment.md)**.

## Local quickstart

Prerequisites: Node.js 22, pnpm 12.4.1, and Docker Desktop for the local Supabase stack.

```bash
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:reset
pnpm db:types
```

Copy the local API URL, publishable/anon key, and secret/service-role key reported by `supabase status` into `.env.local`.

Serve the Local service with

```bash
pnpm dev
```

Open `http://localhost:3000` for the German landing page and `/admin` for the dashboard. The migration creates `admin@gmail.com` with initial password `Pass1234`; the UI requires an immediate password change.

In a second terminal run

```bash
pnpm inngest:dev
```

then open `http://localhost:8288`. Local `.env.local` should contain `INNGEST_DEV=1`; cloud Inngest keys stay empty. See the [local Inngest instructions](docs/development/local-setup.md#local-inngest).

For browser testing without a Meta account or device, enable Simulator in the selected organization's settings and open `/admin/simulator`. Add customer chat windows and use database-backed owner/technician windows; replies and notifications appear in the UI. Supabase and Inngest are required, plus an organization OpenAI key for natural conversations. Real WhatsApp can run alongside it. See [the simulator setup](docs/development/local-setup.md#browser-whatsapp-simulator).

Run all repository checks with:

```bash
pnpm check
```

Application deployment uses Vercel's GitHub integration. Supabase Branching's GitHub integration validates and applies migrations.

Start with [the documentation index](docs/index.md) and [coding-agent guide](AGENTS.md). Product scope lives in [the requirements](docs/product/requirements.md); code and tests describe the current implementation.
