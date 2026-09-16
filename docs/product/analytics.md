# Analytics definitions

All booking dashboard totals and CSV cohorts use booking `created_at` in the selected reporting timezone. The Overview date-range picker defaults to the current month and provides footer shortcuts for This month, Last month, Last 30 days, and Last 90 days. Booking start time is shown separately. A cancellation changes current status but does not remove the booking from its creation cohort.

- **Total bookings:** count of booking rows in the cohort.
- **Currently confirmed:** cohort rows whose current `status` is `confirmed`.
- **Cancelled:** cohort rows whose current `status` is `cancelled`.
- **Unique booking customers:** distinct `contact_id` values in the cohort.
- **Returning customers:** unique cohort customers with at least one earlier booking for the configured business before the cohort start.
- **Repeat rate:** returning customers divided by unique booking customers, multiplied by 100. Empty cohorts return zero.
- **Daily trend:** the three status counts grouped by the reporting-local date of `created_at`.

Example: Ana booked twice this month, one currently cancelled; Bo booked once; Ana had a booking last month. The month reports total 3, confirmed 2, cancelled 1, unique customers 2, returning customers 1, repeat rate 50%. It does not report visits, no-shows, revenue, or an amount due.

All analytics cover the configured business. The booking graph, accessible table, and booking CSV use the same definitions. Booking counts do not calculate charges or invoices.

## Platform activity

The section below booking reports shares the inclusive date range (maximum 366 days) and `PLATFORM_TIMEZONE`. Database bounds are local midnight through the exclusive midnight after the final day, including DST changes and sub-millisecond timestamps. Its source selector defaults to WhatsApp; Simulator and All sources are also available.

- **Received:** unique registered inbound message events by `received_at`. Delivery/status callbacks are excluded; provider event IDs already deduplicate webhook retries.
- **Sent:** unique outbox rows with `sent_at` in the period, including staff notifications with no conversation ID. This measures provider acceptance (or simulator capture), not delivery/read receipts. A later failure does not erase the send attempt. Queued/failed rows without `sent_at` do not count.
- **Active users:** distinct inbound `contact_wa_id` values across the whole period, including customers, owners, and technicians. Receiving an outbound notification alone does not make someone active. All sources deduplicates the same WA ID across channels.
- **Daily trends:** received, sent, daily active senders, chat calls, image calls, and known estimated USD costs. Daily active counts must not be added to produce the period total.
- **AI requests:** one tracked SDK invocation, including each chat tool round and each image edit. The SDK may internally retry HTTP requests; those transport retries are not separate log entries. Further application invocations create new entries.
- **AI tokens:** provider-reported input, cached input (a subset), output (including reasoning), and image/text input splits where supplied. Missing usage stays null in individual logs and is counted separately in model summaries. Images generated counts returned outputs before upload.
- **Estimated AI cost:** USD rates per million tokens are snapshotted per invocation. Chat cost is `(uncached input × input rate + cached input × cached rate + output × output rate) / 1,000,000`. Image cost uses separate text input, image input, image output, and optional text output rates. Unknown prices or usage produce null, not zero. Aggregates are known subtotals with unpriced counts, not invoices. Pricing changes do not reprice historical records.

Example: Ana sends twice on Monday and once on Tuesday; an owner sends once on Tuesday. The bot sends five messages, including a notification to a technician who never replies. Received = 4, sent = 5, active users = 2. Daily active users are 1 and 2, not a period total of 3.

Illustrative pricing example (not a price quote): at input/cached/output rates of 1/0.5/2 USD per million, 1,000 input tokens including 200 cached and 100 output tokens cost $0.0011. If another request lacks usage, the subtotal remains $0.0011 with one unpriced request. If 2,000 text input, 3,000 image input, and 4,000 image output tokens use rates 1/2/3, image cost is $0.02. Two generated images count as two even if one upload fails.

`GET /api/admin/platform`, the charts, accessible tables, and `GET /api/admin/reports/platform.csv` share the same database aggregation. `GET /api/admin/ai-usage` paginates individual calls within the same date/source selection. All require an admin. Database aggregation avoids the REST row limit. AI history starts when instrumentation is deployed; earlier tokens cannot be reconstructed. Current queue health remains an all-date/all-source snapshot.
