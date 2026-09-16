-- Customer technician preferences are universally optional whenever active
-- technicians are available at the selected salon.
alter table public.salons
drop column customer_can_choose_technician;
