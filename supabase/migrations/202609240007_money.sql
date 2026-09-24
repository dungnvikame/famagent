-- Family Finance MVP (SPEC_V2 §7–12, plan 260924-1036 §3/§6). Ledger modelled on the household Excel the
-- product owner uses: one row per entry with kind expense | income | saving (saving > 0 moves cash into
-- savings, < 0 withdraws), a child flag, and per-month category budgets. Balances are derived, never stored:
--   cash    = opening_cash    + Σincome − Σexpense − Σsaving
--   savings = opening_savings + Σsaving
-- Add-only. Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-money.sql

create table public.money_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opening_cash bigint not null default 0,
  opening_savings bigint not null default 0,
  -- Planned spend per month ("Kế hoạch"); null = not set yet.
  monthly_plan bigint check (monthly_plan is null or monthly_plan > 0),
  -- User-editable category list (defaults are seeded by the app on first use).
  categories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  content text not null check (char_length(content) between 1 and 120),
  category text not null check (char_length(category) between 1 and 40),
  kind text not null check (kind in ('expense','income','saving')),
  -- VND, integer. Saving may be negative (withdrawal); expense/income must be positive.
  amount bigint not null check (amount <> 0 and (kind = 'saving' or amount > 0)),
  for_child boolean not null default false,
  child_id uuid references public.children(id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  source text not null default 'manual' check (source in ('manual','recurring','purchase')),
  recurring_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index money_transactions_user_month_idx on public.money_transactions(user_id, occurred_on desc);

create table public.money_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  month date not null check (extract(day from month) = 1),
  limit_amount bigint not null check (limit_amount > 0),
  unique (user_id, category, month)
);

create table public.money_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (char_length(category) between 1 and 40),
  kind text not null check (kind in ('expense','income','saving')),
  amount bigint not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  -- First day of the last month this item was posted into the ledger (auto-post is idempotent per month).
  last_posted_month date check (last_posted_month is null or extract(day from last_posted_month) = 1),
  created_at timestamptz not null default now()
);

create table public.money_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_amount bigint not null check (target_amount > 0),
  saved_amount bigint not null default 0 check (saved_amount >= 0),
  monthly_plan bigint check (monthly_plan is null or monthly_plan > 0),
  created_at timestamptz not null default now()
);

alter table public.money_settings enable row level security;
alter table public.money_transactions enable row level security;
alter table public.money_budgets enable row level security;
alter table public.money_recurring enable row level security;
alter table public.money_goals enable row level security;

create policy "Own money settings" on public.money_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own money transactions" on public.money_transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own money budgets" on public.money_budgets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own money recurring" on public.money_recurring for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own money goals" on public.money_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Financial data is member-only: anonymous guests finish registration first (middleware + RLS to authenticated only).
revoke all on public.money_settings, public.money_transactions, public.money_budgets, public.money_recurring, public.money_goals from anon;
