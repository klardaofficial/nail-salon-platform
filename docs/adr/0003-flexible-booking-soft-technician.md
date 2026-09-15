# ADR 0003: Flexible bookings and soft technician references

Status: Accepted, 2026-09-15.

A booking requires only an active salon and future timestamp and is immediately confirmed. Services, duration, capacity, pricing, technician, and attendance are optional. `bookings.technician_ref` is a nullable UUID without a foreign key; technician name is snapshotted when resolution succeeds.

Strict scheduling/resource validation was rejected because the product goal is low-friction customer attraction. The consequence is that a confirmed booking is a customer request, not a guaranteed staff slot or attendance record. Time off informs suggestions only.

Affected modules: booking SQL functions, conversation prompt/tools, analytics labels, admin booking table.
