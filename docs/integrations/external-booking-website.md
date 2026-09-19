# External booking website integration

This guide is for building an external booking website (or an AI agent
building one) that hands a customer off to WhatsApp with their appointment
selections already made. It is self-contained: no access to this repository
is required to follow it. The only input you need is the **organization ID**
(a UUID), supplied by the salon operator.

There is no API key, no authentication, and no availability lookup. There is
no callback the organization sends you: the only "callback" in this
integration is the browser landing back on WhatsApp after step 2 below.
Nothing here pushes booking status to your site.

## The two endpoints

| Purpose                                 | Endpoint                                          |
| --------------------------------------- | ------------------------------------------------- |
| 1. Discover this organization's catalog | `GET /api/public/{organizationId}/catalog`        |
| 2. Hand the customer to WhatsApp        | `GET /api/public/{organizationId}/booking-intent` |

Both are public GET endpoints, CORS-enabled (`Access-Control-Allow-Origin: *`),
so you can call the catalog endpoint with `fetch()` from your own frontend. The
catalog response is cached for up to 60 seconds — re-fetch on each page load
rather than hardcoding a previous response's IDs.

## Step 1: fetch the catalog

```
GET /api/public/00000000-0000-4000-8000-000000000101/catalog
```

Example response for an organization with some setup done:

```json
{
  "data": {
    "organization": { "id": "00000000-0000-4000-8000-000000000101", "name": "Glow Nails" },
    "bookingUrl": "https://example.com/api/public/00000000-0000-4000-8000-000000000101/booking-intent",
    "bookingTimezone": "Europe/Berlin",
    "openTime": "09:00",
    "closeTime": "18:00",
    "bookingIntervalMinutes": 30,
    "defaultLanguage": "de",
    "salonSelection": "implicit",
    "rules": {
      "startsAtFormat": "YYYY-MM-DDTHH:mm",
      "minLeadTimeMinutes": 15,
      "maxServiceIds": 20,
      "maxAdditionalRequestLength": 1000
    },
    "salons": [
      { "id": "...salon-uuid...", "name": "Glow Nails Downtown", "locationLabel": "Main St 1" }
    ],
    "services": [
      {
        "id": "...service-uuid...",
        "name": "Manicure",
        "description": "Classic manicure",
        "salonIds": []
      }
    ],
    "technicians": [
      { "id": "...technician-uuid...", "displayName": "Kim", "salonId": "...salon-uuid..." }
    ]
  }
}
```

**A brand-new organization with nothing set up yet returns the same shape with
every list empty:**

```json
{
  "data": {
    "organization": { "id": "00000000-0000-4000-8000-000000000101", "name": "Glow Nails" },
    "bookingUrl": "https://example.com/api/public/00000000-0000-4000-8000-000000000101/booking-intent",
    "bookingTimezone": "Europe/Berlin",
    "openTime": "09:00",
    "closeTime": "18:00",
    "bookingIntervalMinutes": 30,
    "defaultLanguage": "de",
    "salonSelection": "none",
    "rules": {
      "startsAtFormat": "YYYY-MM-DDTHH:mm",
      "minLeadTimeMinutes": 15,
      "maxServiceIds": 20,
      "maxAdditionalRequestLength": 1000
    },
    "salons": [],
    "services": [],
    "technicians": []
  }
}
```

**Your UI must handle this without crashing or getting stuck.** `salons`,
`services`, and `technicians` can each independently be empty at any time —
not just for a brand-new organization, but any time the owner removes their
last salon, service, or technician. Do not render an empty dropdown as a
loading spinner that never resolves, and do not block the booking form on any
of these three lists having entries.

### Field reference

- `organization.id` / `organization.name` — display only.
- `bookingUrl` — the base URL for step 2. Append query parameters to it; do
  not construct this URL yourself.
- `bookingTimezone` — an IANA timezone name (e.g. `Europe/Berlin`). This is
  the _only_ timezone that matters: `startsAt` in step 2 is a naive
  `YYYY-MM-DDTHH:mm` string with no offset, interpreted in this zone by the
  server. Show times to the customer in this zone.
- `openTime` / `closeTime` / `bookingIntervalMinutes` — the organization's
  default business hours and appointment spacing, for building a sensible time
  picker. **These are organization-wide and advisory only.** They are not
  enforced by the server — the booking-intent endpoint accepts any future time
  at least `rules.minLeadTimeMinutes` out, open hours or not. If several
  salons exist, they may keep different actual hours; this is a hint, not a
  constraint.
- `defaultLanguage` — the organization's configured language (e.g. `de`), also
  advisory. The bot actually replies in whatever language the customer writes
  to it in, so do not promise the customer a reply in this language.
- `salonSelection` — tells you whether to collect a salon choice at all. See
  the table below.
- `rules` — the exact limits `booking-intent` enforces, so your form can
  validate before submitting: `startsAtFormat` (see below),
  `minLeadTimeMinutes` (soonest bookable time from now), `maxServiceIds`
  (max entries in `serviceIds`), `maxAdditionalRequestLength` (max characters
  in `additionalRequest`).
- `salons[].id` / `.name` / `.locationLabel` — pick one of these to send as
  `salonId` in step 2, only when required (see below).
- `services[].id` / `.name` / `.description` — pick zero or more of these to
  send as `serviceIds`. `salonIds: []` means the service is offered at every
  salon; a non-empty list means it is offered only at those salons — filter
  your service picker by the salon the customer chose, if any. There is no
  duration or price field: this organization's services carry no such data,
  so do not invent or display one.
- `technicians[].id` / `.displayName` / `.salonId` — pick zero or one of these
  to send as `technicianRef`, only for the salon the customer chose (or any,
  if no salon applies).

### `salonSelection` decision table

| Value        | Meaning                    | What to send in step 2                        |
| ------------ | -------------------------- | --------------------------------------------- |
| `"none"`     | No active salon exists yet | Omit `salonId` entirely                       |
| `"implicit"` | Exactly one active salon   | Omit `salonId` — it is chosen automatically   |
| `"required"` | More than one active salon | You must send `salonId`, or the request fails |

Never show a salon picker when `salonSelection` is `"none"` or `"implicit"` —
and never send a `salonId` in those cases either; if you do and it happens to
not match an active salon, the request fails outright.

## Step 2: hand the customer to WhatsApp

**The only required field is `startsAt`. Everything else — salon, services,
technician, additional request — is optional, and your UI must let the
customer skip all of them.** The salon's bot will ask about anything left
unfilled once the customer starts chatting, so there is no need to force a
complete form before the customer can proceed.

```
GET {bookingUrl}?startsAt=2026-09-20T15:00&serviceIds=<uuid>,<uuid>&technicianRef=<uuid>&additionalRequest=<text>
```

| Parameter           | Required                                  | Value                                                                                                           |
| ------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `startsAt`          | **Yes**                                   | `YYYY-MM-DDTHH:mm`, naive local time in `bookingTimezone`, at least `rules.minLeadTimeMinutes` minutes from now |
| `salonId`           | Only when `salonSelection === "required"` | One salon UUID from the catalog                                                                                 |
| `serviceIds`        | No                                        | Comma-separated service UUIDs from the catalog, up to `rules.maxServiceIds`                                     |
| `technicianRef`     | No                                        | One technician UUID from the catalog                                                                            |
| `additionalRequest` | No                                        | Free text, up to `rules.maxAdditionalRequestLength` characters                                                  |

### This is a page navigation, not an API call

Do **not** call this endpoint with `fetch()` or `XMLHttpRequest` — it responds
with an HTTP redirect (307) to a `wa.me` link, and a `fetch()` would follow
that redirect cross-origin and fail (or simply hand you a response your code
then has to re-navigate to, which is more work for no benefit). Instead,
navigate the customer's own browser there directly:

```js
window.location.href =
  `${bookingUrl}?startsAt=${encodeURIComponent(startsAt)}` +
  (serviceIds.length ? `&serviceIds=${serviceIds.join(",")}` : "") +
  (technicianRef ? `&technicianRef=${technicianRef}` : "") +
  (additionalRequest ? `&additionalRequest=${encodeURIComponent(additionalRequest)}` : "");
```

A plain `<a href="...">` link works just as well.

### A `307` redirect means "handed off", not "validated"

Once the endpoint has a working WhatsApp destination to send the customer to,
**every subsequent error — an invalid ID, a time in the past, anything — still
redirects to WhatsApp with a plain wave (👋) instead of showing an error.**
This is deliberate: the customer always reaches a working chat rather than a
dead end. But it means you cannot tell, from the redirect alone, whether the
selections you sent were actually accepted. Practical implications:

- Don't hardcode UUIDs you fetched once, long ago — re-fetch the catalog on
  each visit so you're always sending IDs that currently exist.
- If something is rejected (e.g. a stale service ID), the customer still ends
  up in a working chat with the bot, which will ask them directly for
  whatever is missing. Nothing is lost; the fallback is graceful by design.

### Errors

A JSON error (not a redirect) is returned only when there is no request to
even attempt — malformed input, or the endpoint being unreachable. In
practice, for this integration, treat any non-redirect JSON response from
`bookingUrl` as a bug in your request, not a customer-facing state to retry.

The catalog endpoint returns `404 organization_not_available` for an unknown,
malformed, or inactive organization ID — this is a setup/configuration
problem (the wrong ID was configured for your site), not something to show
the customer or retry.

## Other things worth knowing

- **Daylight saving time**: `startsAt` is parsed by interpreting your naive
  local time in `bookingTimezone`. A time that falls inside a spring-forward
  gap (a local time that never actually occurs, e.g. 2:30 AM on the day clocks
  jump from 2:00 to 3:00) is not rejected — it is silently shifted by the
  underlying date library. Avoid offering times inside that gap if you know
  the organization's DST transition dates.
- **No availability lookup exists.** This integration does not tell you which
  times are actually free — it only tells you what the organization _is_
  (salons, services, technicians, hours). The bot itself handles conflict
  checking once the customer is chatting.
- **Repeated identical requests are safe.** Submitting the exact same
  selections twice in a row (e.g. a double-click) reuses the same underlying
  intent rather than creating a duplicate.
