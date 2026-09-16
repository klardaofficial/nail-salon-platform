# ADR 0003: Flexible bookings and soft technician references

Status: Accepted (revised), 2026-09-16.

A booking requires an active singleton business, a future timestamp, and customer agreement, and auto-confirms. With no active salons, salon_id is null and the platform timezone applies. A sole active salon is selected automatically; several active salons require a resolved choice. A supplied stale/inactive salon is rejected. Services, duration, capacity, pricing, technician, and attendance remain optional.

`bookings.technician_ref` remains a nullable UUID without a foreign key. Unresolved references may persist; a valid matching technician supplies a name snapshot and notification recipient. References to another salon are not assigned. Customer technician choice is skipped when disabled or unconfigured. Missing display values use [N/A], never a fabricated catalog record.

Collect only missing required details, one focused question at a time. A clear instruction to book the exact supplied details counts as agreement; otherwise summarize and obtain agreement once. Do not delay for optional service, staff, or additional-request questions.

Strict scheduling/resource validation was rejected because the product goal is low-friction customer attraction. A confirmed booking is a customer request, not guaranteed staff capacity or attendance. Time off guides suggestions only. The database rechecks activity, future time, salon choice and timezone, while idempotency preserves the original booking on replay.

Affected modules: booking SQL functions, conversation prompt/tools, analytics labels, admin booking table and CSV.

2026-09-16 timezone revision: all conversation bookings use the configured platform timezone, including bookings with a salon. The booking RPC validates the platform setting instead of the salon timezone. Customer location, language and stated timezone are irrelevant to interpretation. WhatsApp displays contain only dates and clock times; the configured timezone stays internal. Existing booking instants and snapshots are preserved, and conversation read/notification paths format those instants using current platform settings.

2026-09-16 customer-update revision: a customer may use `update_booking` to change their own confirmed future booking's time, salon, services, technician, or additional request. The immutable booking ID/reference and reporting identity are retained, rather than cancelling the booking and creating another. The transactional function rechecks customer ownership, confirmed/future state, active business/salon, and platform timezone; it replaces service snapshots and records one idempotent `booking.rescheduled` event with prior/new values. When technician assignment changes, the former technician receives the normal cancellation notification and the newly assigned technician receives the normal confirmation notification with updated appointment details.
