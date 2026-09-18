# Configuration

Server secrets belong in `.env.local` or encrypted deployment variables. Never prefix secrets with `NEXT_PUBLIC_`.

## Runtime environment

| Variable                               | Secret    | Purpose                                                                 |
| -------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `APP_ENV`                              | No        | `local`, `dev`, or `prod`                                               |
| `APP_URL`                              | No        | Public application base URL used for callbacks                          |
| `VERCEL_AUTOMATION_BYPASS_SECRET`      | Sensitive | Server-only protection bypass appended to authorized Meta callback URLs |
| `NEXT_PUBLIC_SUPABASE_URL`             | No        | Environment-specific Supabase URL                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No        | Browser publishable key                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`            | Yes       | Server routes/jobs only; never exposed to the browser                   |
| `INNGEST_DEV`                          | No        | `1` for the local dev server                                            |
| `INNGEST_EVENT_KEY`                    | Yes       | Hosted event submission                                                 |
| `INNGEST_SIGNING_KEY`                  | Yes       | Hosted invocation verification                                          |

Organization timezone, hours, interval, locale, preview limits, simulator enablement, Meta identifiers/overrides, technician templates, and OpenAI key/models/pricing are database settings edited through organization-scoped admin APIs. Root Meta credentials/default templates are system settings. Runtime provider code has no legacy Meta/OpenAI/simulator environment fallback.

Meta overrides require access token, app secret, and verify token together. Organization editors receive only that organization's saved override; inherited root secrets are never returned. OpenAI keys are write-only. Changing routing or credentials invalidates provider validation; an active mapping accepts real traffic automatically after it validates successfully.

`VERCEL_AUTOMATION_BYPASS_SECRET` is never sent to the browser except as part of a system/organization-authorized callback URL display. It is not stored in QR codes, jobs, provider settings, or logs.

## One-time OpenAI bootstrap

The rerunnable `pnpm organizations:bootstrap` command may import an existing OpenAI configuration into empty default-organization fields. These variables are bootstrap inputs, not runtime configuration:

- `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_PRICING_JSON`

The bootstrap uses built-in organization defaults: German, Europe/Berlin, 09:00–18:00, a 30-minute interval, three preview requests per day, and three previews per request. It never imports Meta or simulator settings: root Meta credentials and organization routing identifiers start empty, and simulator enablement starts false. Configure them through the authorized dashboard. The command does not overwrite existing provider values. Do not print secret values.

## Provider notes

WhatsApp Graph API is pinned to `v26.0`. Customer QR is generated locally from Meta's validated E.164 display number. The simulator is enabled per active organization and needs Supabase/Inngest plus that organization's OpenAI key for natural replies; Meta credentials are unnecessary for simulated delivery.

AI cost estimates use model-keyed nonnegative USD rates per million units stored in `organization_provider_settings.openai_pricing`. Missing usage or rates remains unknown, never zero. Prices are snapshotted on each numeric-only usage event; provider billing may differ.
