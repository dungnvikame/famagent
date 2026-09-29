-- Fixed items become reminders instead of auto-posts (plan 260929-0926 §4.2). Each period of a fixed item is
-- answered by the family ("Đã trả?" with the real date and amount) or skipped; the answer lives in
-- money_recurring_periods, and unique (recurring_id, period) makes double taps and two devices safe.
-- Additive and idempotent. Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-fixed-items.sql
-- Apply BEFORE deploying the code that reads/writes these columns.

alter table public.money_recurring
  -- When it comes due inside a month (jsonb RecurringSchedule: month | range | eom | quarter | year); null = monthly on day_of_month.
  add column if not exists schedule jsonb,
  -- 'estimate' = the amount is a first guess; later periods default to the average of the last paid ones.
  add column if not exists amount_mode text not null default 'fixed' check (amount_mode in ('fixed','estimate'));

-- Saved every month; the month plan is planned income minus this. null = not set.
alter table public.money_settings
  add column if not exists monthly_saving bigint check (monthly_saving is null or monthly_saving >= 0);

create table if not exists public.money_recurring_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_id uuid not null references public.money_recurring(id) on delete cascade,
  -- YYYY-MM of the period the answer is for.
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  status text not null check (status in ('paid','skipped')),
  paid_on date,
  amount bigint check (amount is null or amount > 0),
  -- Ledger entry written by the confirmation (undo deletes it); no foreign key: the entry may be deleted from the ledger.
  transaction_id uuid,
  created_at timestamptz not null default now(),
  unique (recurring_id, period)
);
create index if not exists money_recurring_periods_user_idx on public.money_recurring_periods(user_id);

alter table public.money_recurring_periods enable row level security;

drop policy if exists "Own money recurring periods" on public.money_recurring_periods;
create policy "Own money recurring periods" on public.money_recurring_periods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Financial data is member-only, same as the other money tables.
revoke all on public.money_recurring_periods from anon;
