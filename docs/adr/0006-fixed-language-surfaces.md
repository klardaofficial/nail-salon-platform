# ADR 0006: Fixed language surfaces

Status: Accepted, 2026-09-15.

The marketing surface is German, the admin surface is English, and WhatsApp/AI uses exactly `BOT_LOCALE=en|de` for a deployment. Both greeting texts may be edited, but database/user/browser language signals never select the active bot locale.

Runtime language switching and web i18n were rejected for initial scope. Separate root layouts and small bot dictionaries keep behavior explicit. Changing bot language requires an environment update and redeploy.

Affected modules: root layouts, bot dictionaries, conversation prompt, settings UI, deployment configuration.
