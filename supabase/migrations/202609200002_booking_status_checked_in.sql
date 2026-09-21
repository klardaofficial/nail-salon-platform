-- New enum value must land in its own migration/transaction: PostgreSQL
-- forbids using a value added by ALTER TYPE ... ADD VALUE in the same
-- transaction that added it. See 202609200003_booking_checkin_and_single_active.sql
-- for the columns, constraint, and functions that use 'checked_in'.
alter type public.booking_status add value 'checked_in';
