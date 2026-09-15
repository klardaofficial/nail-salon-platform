# Configuration

Server secrets belong in `.env.local`, Vercel encrypted environment variables, or GitHub environment secrets. Never prefix secrets with `NEXT_PUBLIC_`.

| Variable                               | Secret    | Default/scope                                | Redeploy                                      |
| -------------------------------------- | --------- | -------------------------------------------- | --------------------------------------------- |
| `APP_ENV`                              | No        | `local`; `local`, `dev`, or `prod`           | Yes                                           |
| `APP_URL`                              | No        | Public application base URL                  | Yes                                           |
| `BOT_LOCALE`                           | No        | `de`; only `de` or `en`                      | **Yes; this is the only bot language switch** |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`          | No        | Digits used in landing-page `wa.me` link     | Yes                                           |
| `NEXT_PUBLIC_SUPABASE_URL`             | No        | Environment-specific Supabase URL            | Yes                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No        | Environment-specific browser key             | Yes                                           |
| `SUPABASE_SERVICE_ROLE_KEY`            | Yes       | Server routes and background jobs only       | Yes                                           |
| `WHATSAPP_API_VERSION`                 | No        | `v23.0`                                      | Yes                                           |
| `WHATSAPP_PHONE_NUMBER_ID`             | Sensitive | Meta phone number ID                         | Yes                                           |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`         | Sensitive | Meta account ID                              | Yes                                           |
| `WHATSAPP_ACCESS_TOKEN`                | Yes       | Meta Graph token                             | Yes                                           |
| `WHATSAPP_APP_SECRET`                  | Yes       | HMAC verification                            | Yes                                           |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`        | Yes       | GET challenge token                          | Yes                                           |
| `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`  | No        | Optional approved technician template        | Yes                                           |
| `WHATSAPP_TEMPLATE_BOOKING_CANCELLED`  | No        | Optional approved technician template        | Yes                                           |
| `OPENAI_API_KEY`                       | Yes       | Server/jobs only                             | Yes                                           |
| `OPENAI_CHAT_MODEL`                    | No        | `gpt-5-mini`                                 | Yes                                           |
| `OPENAI_IMAGE_MODEL`                   | No        | `gpt-image-1`                                | Yes                                           |
| `INNGEST_DEV`                          | No        | `1` locally; omit or set `0` when hosted     | Yes                                           |
| `INNGEST_EVENT_KEY`                    | Yes       | Cloud event submission; blank locally        | Yes                                           |
| `INNGEST_SIGNING_KEY`                  | Yes       | Cloud invocation verification; blank locally | Yes                                           |
| `PLATFORM_TIMEZONE`                    | No        | `Europe/Berlin`; environment fallback        | Yes                                           |
| `DEFAULT_OPEN_TIME`                    | No        | `09:00`; initial/fallback setting            | Yes                                           |
| `DEFAULT_CLOSE_TIME`                   | No        | `18:00`; initial/fallback setting            | Yes                                           |
| `DEFAULT_BOOKING_INTERVAL_MINUTES`     | No        | `30`; a suggestion, not capacity             | Yes                                           |
| `PREVIEW_REQUESTS_PER_DAY`             | No        | `3`; deployment ceiling                      | Yes                                           |
| `PREVIEWS_PER_REQUEST`                 | No        | `3`; deployment ceiling                      | Yes                                           |

Admin dashboard settings persist platform timezone, default hours/interval, both greeting texts, and preview limits. Runtime preview enforcement uses the lower of environment and dashboard values. Editing greeting text takes effect without choosing a new language; `BOT_LOCALE` is never read from the database, browser, customer text, or language detection.
