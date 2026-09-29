-- Height on the growth chart (plan 260929-1508): child_weights now holds one measurement per child per day —
-- weight, height or both (the table name is kept to avoid a rename of live data).
-- Additive and idempotent. Back up child_weights before applying; apply BEFORE deploying the code.
alter table public.child_weights alter column weight_kg drop not null;
alter table public.child_weights
  add column if not exists height_cm numeric(4,1) check (height_cm is null or (height_cm >= 35 and height_cm <= 200));
alter table public.child_weights drop constraint if exists child_weights_has_measure;
alter table public.child_weights add constraint child_weights_has_measure check (weight_kg is not null or height_cm is not null);
