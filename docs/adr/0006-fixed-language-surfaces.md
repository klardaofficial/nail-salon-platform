# ADR 0006: Fixed web languages and adaptive WhatsApp language

Status: Accepted (revised), 2026-09-16.

The marketing surface remains German and the admin surface English. WhatsApp follows the customer's, owner's, or technician's conversation language without an application language allowlist. `BOT_LOCALE` accepts any valid BCP 47 language tag (underscore variants are normalized) and supplies only the initial reference when customer language is unclear. The model infers language from the person's text, honors switches, and retains the previous language for ambiguous dates, names, numbers, and interactive taps.

The model generates all conversational text, greetings, option titles/descriptions, list button labels, and list headings. The app validates structured output and WhatsApp limits; it does not replace labels with a dictionary. Admin greeting settings are removed. Each contact/channel stores its latest reply locale and an AI-generated unavailable message for outages. Before a localized fallback exists, an outage uses a language-neutral status.

Ordinary staff notifications and preview captions are AI-written in the recipient's conversation language. Approved Meta templates retain their approved content and language contract; the app supplies the configured template and its required parameters.

This supersedes the initial fixed English/German bot policy. The default changes after an environment update/redeploy; conversational language changes immediately. Fixed web languages do not depend on bot language.

Affected modules: bot configuration, conversation history/prompt/structured replies, notifications, previews, settings UI, deployment configuration.
