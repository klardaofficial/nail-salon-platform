# Analytics definitions

All dashboard totals and CSV cohorts use booking `created_at` in the selected reporting timezone. Booking start time is shown separately. A cancellation changes current status but does not remove the booking from its creation cohort.

- **Total bookings:** count of booking rows in the cohort.
- **Currently confirmed:** cohort rows whose current `status` is `confirmed`.
- **Cancelled:** cohort rows whose current `status` is `cancelled`.
- **Unique booking customers:** distinct `contact_id` values in the cohort and selected business scope.
- **Returning customers:** unique cohort customers with at least one booking in the same business scope before the cohort start.
- **Repeat rate:** returning customers divided by unique booking customers, multiplied by 100. Empty cohorts return zero.
- **Daily trend:** the three status counts grouped by the reporting-local date of `created_at`.

Example: Ana booked twice this month, one currently cancelled; Bo booked once; Ana had a booking last month. The month reports total 3, confirmed 2, cancelled 1, unique customers 2, returning customers 1, repeat rate 50%. It does not report visits, no-shows, revenue, or an amount due.

Business filters must apply to both current and historical returning-customer queries. The dashboard graph, accessible table, and booking CSV use the same API definitions. Monthly charging decisions may use these counts externally; no currency or invoice formula is implemented.
