-- WHO growth chart (plan 260929-1508): weight-for-age curves differ for boys and girls.
-- Additive and idempotent; null = not given (the chart then asks). Back up children before applying.
alter table public.children
  add column if not exists sex text check (sex is null or sex in ('male','female'));
