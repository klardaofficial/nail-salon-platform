# Analytics definitions

All dashboard totals and CSV cohorts use booking `created_at` in the selected reporting timezone. The Overview date-range picker defaults to the current month and provides footer shortcuts for This month, Last month, Last 30 days, and Last 90 days. Booking start time is shown separately. A cancellation changes current status but does not remove the booking from its creation cohort.

- **Total bookings:** count of booking rows in the cohort.
- **Currently confirmed:** cohort rows whose current `status` is `confirmed`.
- **Cancelled:** cohort rows whose current `status` is `cancelled`.
- **Unique booking customers:** distinct `contact_id` values in the cohort.
- **Returning customers:** unique cohort customers with at least one earlier booking for the configured business before the cohort start.
- **Repeat rate:** returning customers divided by unique booking customers, multiplied by 100. Empty cohorts return zero.
- **Daily trend:** the three status counts grouped by the reporting-local date of `created_at`.

Example: Ana booked twice this month, one currently cancelled; Bo booked once; Ana had a booking last month. The month reports total 3, confirmed 2, cancelled 1, unique customers 2, returning customers 1, repeat rate 50%. It does not report visits, no-shows, revenue, or an amount due.

All analytics cover the configured business. The dashboard graph, accessible table, and booking CSV use the same API definitions. Monthly charging decisions may use these counts externally; no currency or invoice formula is implemented.
