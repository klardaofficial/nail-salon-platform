# Production deployment guide

This guide deploys the application without custom Vercel or Supabase deploy workflows. Vercel and Supabase each watch GitHub directly. The repository `Quality` Action remains a required validation check.

## 1. Production accounts and values

Prepare these accounts before connecting the repository:

- GitHub repository with `main` as the protected production branch.
- A production Supabase project with Branching/GitHub integration available.
- A Vercel project connected to the repository.
- Meta Business, WhatsApp Business Account, production phone number, and Meta app.
- OpenAI production project and restricted API key.
- Inngest production environment.

Choose the final HTTPS domain and bot language before deployment. The language is `BOT_LOCALE=de` or `BOT_LOCALE=en` and changes only after an environment update plus redeploy.

## 2. Protect `main` in GitHub

In **GitHub | Settings | Branches | Branch protection rules**, protect `main` and enable:

1. Require a pull request before merging.
2. Require status checks to pass.
3. Select the repository `Quality / application` and `Quality / database` checks.
4. After Supabase is connected, add its preview/migration check as required.
5. Require branches to be up to date before merging.

Do not commit `.env.local`, service-role keys, WhatsApp tokens, customer exports, or image data.

## 3. Connect Supabase to GitHub

The `supabase/` directory is already initialized with `config.toml` and migrations. Local resets and production both start without salon/customer seed data; the schema migration creates only the required initial admin account.

1. Open **Supabase Dashboard | Project Settings | Integrations**.
2. Under **GitHub Integration**, select **Authorize GitHub** and grant only the intended repository.
3. Select this repository.
4. Set **Working directory** to `.` because `supabase/` is at repository root.
5. Map the production branch to `main`.
6. Enable preview branches for pull requests if the plan supports them.
7. Enable **Deploy to production** so new migration files apply after a push/merge to `main`.
8. Enable branch failure email notifications.
9. Add the Supabase check to GitHub's required status checks.

The integration applies new SQL migrations and declared Edge Functions/storage resources. Supabase documents that Auth/API settings are not deployed by default, so configure those production settings in the dashboard.

In **Authentication | URL Configuration**, set the site URL to the final production URL. Disable public sign-up; the initial platform administrator is created by the schema migration. Review password policy and session duration.

Before the first application login, confirm the Supabase branch reports the migration `202609150001_initial_schema.sql` as applied. The initial administrator tables must exist first.

Official setup reference: [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration).

## 4. Create provider credentials

### OpenAI

1. Create a production OpenAI project with separate billing/limits from development.
2. Create a restricted server API key.
3. Confirm access to the configured Responses and image models.
4. Set conservative project budgets and alerting before enabling previews.

The repository defaults to `gpt-5-mini` and `gpt-image-1`; use model IDs available to the production project and pin them in Vercel.

### Inngest

1. Create/select the production Inngest environment.
2. Copy its event key and signing key.
3. After the first Vercel deployment, register/sync `https://YOUR_DOMAIN/api/inngest` in Inngest.
4. Confirm these functions appear: process WhatsApp event, deliver WhatsApp message, generate style preview, recover durable outboxes.
5. Keep the recovery cron enabled and review retry/concurrency settings against the production plan.

### Meta WhatsApp

1. Create or select the production Meta app and WhatsApp Business Account.
2. Add the shared production phone number and complete Meta verification.
3. Create a durable production access token with the required WhatsApp permissions.
4. Choose a random webhook verify token and keep the Meta app secret available.
5. Create approved technician notification templates in the deployed bot language. In **Admin | Settings**, copy the displayed confirmed and cancelled template text exactly. Both use this body parameter order: salon name, customer name, customer WhatsApp number, local appointment label, booking ID.
6. Record the phone number ID, business account ID, access token, and app secret. Save each approved template name in **Admin | Settings**.

Do not assume a customer's service window applies to a technician. Approved templates allow technician notifications when their own service window is closed.

## 5. Import the repository into Vercel

1. In Vercel choose **Add New | Project**, import the GitHub repository, and select the Next.js framework preset.
2. Set the root directory to `.` and package manager to pnpm. The committed `packageManager` field pins pnpm 12.4.1.
3. Set the production branch to `main`.
4. Leave Git deployments enabled. No GitHub Action needs a Vercel token.
5. Use a dedicated development Vercel project or non-production environment for `develop`; never put production write credentials in pull-request previews.
6. Add the final custom domain and wait for HTTPS to become active.

Add these variables to Vercel's **Production** environment:

```text
APP_ENV=prod
APP_URL=https://YOUR_DOMAIN
BOT_LOCALE=de
NEXT_PUBLIC_WHATSAPP_NUMBER=YOUR_NUMBER_DIGITS_ONLY

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

WHATSAPP_API_VERSION=v23.0
WHATSAPP_SIMULATOR_ENABLED=0
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...

OPENAI_API_KEY=...
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-1

INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
INNGEST_DEV=0

PLATFORM_TIMEZONE=Europe/Berlin
DEFAULT_OPEN_TIME=09:00
DEFAULT_CLOSE_TIME=18:00
DEFAULT_BOOKING_INTERVAL_MINUTES=30
PREVIEW_REQUESTS_PER_DAY=3
PREVIEWS_PER_REQUEST=3
```

Use the current values from `.env.example` and [configuration reference](../development/configuration.md). Vercel must keep the service-role, WhatsApp, OpenAI, and Inngest keys server-only.

For browser simulation on a hosted environment, set `WHATSAPP_SIMULATOR_ENABLED=1` and redeploy, then open `/admin/simulator` as an administrator. Use the same environment's Supabase/OpenAI and cloud Inngest setup. Simulated and real WhatsApp traffic run alongside each other with separate conversation histories; simulated replies/notifications are captured, while tools still change the configured database. Meta credentials are optional for simulation alone. Set the flag back to `0` and redeploy to disable access. See [browser simulator setup](../development/local-setup.md#browser-whatsapp-simulator).

## 6. First production rollout

Vercel and Supabase respond independently to a Git push. Follow this order for the initial release:

1. Merge a pull request only after GitHub Quality and Supabase checks pass.
2. Watch the Supabase production branch until the migration is applied.
3. Watch the Vercel production deployment until the build is Ready.
4. Verify `https://YOUR_DOMAIN/api/health` returns `status: ok`, `environment: prod`, the intended bot locale, and `databaseConfigured: true`.
5. Open `/admin/login` and sign in as `admin@gmail.com` with the initial password `Pass1234`.
6. Complete the required **Account settings** password change before using the other dashboard pages. Sign out and verify the new password works while `Pass1234` fails.
7. In the admin dashboard, create the real business, salon name/location, and owner WA IDs. Services and technicians may remain empty.
8. Sync/check the Inngest endpoint and functions.

Every migration must be backward compatible with the previous application revision because Vercel and Supabase deploy independently. Use expand, migrate, then contract across separate releases for breaking schema changes.

## 7. Connect the Meta webhook

After the production domain and environment variables are live:

1. Set Meta's callback URL to `https://YOUR_DOMAIN/api/whatsapp/webhook`.
2. Enter the exact `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value.
3. Complete verification and subscribe the WhatsApp account to the `messages` webhook field.
4. Send a test message from a non-staff number.
5. Confirm the greeting language/content, salon choices, natural typed replies, and delivery status in the database/Inngest dashboard.

A GET verification failure usually means the verify token differs. POST 401 means the app secret/signature differs. Do not weaken verification to make the callback pass.

## 8. Production smoke test

Use synthetic/test contacts and make one controlled pass:

- Landing page loads in German and its WhatsApp link opens the shared number.
- Admin login, CRUD, dashboard analytics, and CSV download work.
- First WhatsApp greeting is sent once.
- With several active salons, typed and list selection both work.
- A future booking with no service/technician confirms.
- A multi-service booking with an Other request confirms.
- Cancellation before start remains in confirmed/cancelled analytics.
- Technician confirmed/cancelled templates deliver.
- A hand/nail image produces no more than three previews and the fourth daily request is rejected at the default quota.
- Database rows contain media IDs only; Vercel/Inngest logs contain no image base64 or secrets.
- A forced transient outbound failure is retried from the message outbox without regenerating a preview.

## 9. Monitoring and rollback

Monitor Vercel errors/duration, Inngest failed runs, Supabase branch/migration status and database health, Meta webhook/delivery quality, and OpenAI usage/budget. Dashboard health counts expose failed jobs, pending messages, and failed previews.

For an application regression, use Vercel's deployment history to promote the last compatible deployment. Do not reverse a migration blindly. Roll back code only if it supports the current schema. Fix schema issues with a new forward migration or a verified Supabase backup restore. Follow [operations runbooks](runbooks.md) for webhook, queue, image, AI, admin, and database incidents.
