# Configuration

Server secrets belong in `.env.local` or encrypted deployment variables. Never prefix secrets with `NEXT_PUBLIC_`.

## Runtime environment

| Variable                               | Secret | Purpose                                               |
| -------------------------------------- | ------ | ----------------------------------------------------- |
| `APP_ENV`                              | No     | `local`, `dev`, or `prod`                             |
| `APP_URL`                              | No     | Public application base URL used for callbacks        |
| `NEXT_PUBLIC_SUPABASE_URL`             | No     | Environment-specific Supabase URL                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No     | Browser publishable key                               |
| `SUPABASE_SERVICE_ROLE_KEY`            | Yes    | Server routes/jobs only; never exposed to the browser |
| `INNGEST_DEV`                          | No     | `1` for the local dev server                          |
| `INNGEST_EVENT_KEY`                    | Yes    | Hosted event submission                               |
| `INNGEST_SIGNING_KEY`                  | Yes    | Hosted invocation verification                        |

`APP_URL` also doubles as the fallback for an organization's optional External Website setting (see BOT-01 in `docs/product/requirements.md`): a deterministic reply (a scripted-mode greeting, or a Cancel-tap confirmation in either mode) names that organization's own booking site when set, or `APP_URL` when it is null. No separate environment variable exists for this.

Organization timezone, hours, interval, locale, preview limits, simulator enablement, AI bot enablement, External Website URL, Meta identifiers/overrides, technician templates, and OpenAI key/models/pricing overrides are database settings edited through organization-scoped admin APIs. Root Meta credentials/default templates and the root OpenAI key/models/pricing are root system settings, edited at `/admin/system/settings` by a system admin. Runtime provider code has no legacy Meta/OpenAI/simulator environment fallback; an organization with no override inherits the root configuration.

Meta overrides require access token, app secret, and verify token together, or all three left blank to fall back to the root credentials. Organization editors receive only that organization's saved override; inherited root secrets are never returned. Likewise, an organization's OpenAI override requires an API key (submitted or already saved), a chat model, an image model, and pricing covering both models together — an organization can never pair its own model choice with the root's billing key, and can never enable an override missing any of those fields. Clearing either override reverts the organization to the root configuration. Changing routing or credentials invalidates provider validation; an active mapping accepts real traffic automatically after it validates successfully.

## Organization bootstrap

The rerunnable `pnpm organizations:bootstrap` command seeds the default organization's settings once: German, Europe/Berlin, 09:00–18:00, a 30-minute interval, three preview requests per day, and three previews per request. It never imports Meta, OpenAI, or simulator settings: root Meta/OpenAI credentials and organization routing identifiers start empty, and simulator enablement starts false. Configure them through the authorized dashboard. The command does not overwrite existing settings values.

## Provider notes

WhatsApp Graph API is pinned to `v26.0`. Customer QR is generated locally from Meta's validated E.164 display number. The simulator is enabled per active organization and needs Supabase/Inngest plus an effective (root or organization) OpenAI key for natural replies; Meta credentials are unnecessary for simulated delivery.

AI cost estimates use model-keyed nonnegative USD rates per million units stored in `root_settings.openai_pricing` or, for an organization override, `organization_provider_settings.openai_pricing`. Missing usage or rates remains unknown, never zero. Prices are snapshotted on each numeric-only usage event; provider billing may differ.
