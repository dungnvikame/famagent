-- Shopping phase 2 (plans/260924-1431-shopping-plan-redesign): "còn không?" stock checks that teach the family's rate,
-- the monthly shopping plan, and ledger expenses the family said are not household shopping. Add-only.
-- Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-shopping-plan.sql

create table public.stock_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.shopping_items(id) on delete cascade,
  checked_on date not null,
  remaining numeric(10,2) not null check (remaining >= 0),
  created_at timestamptz not null default now()
);
create index stock_checks_user_item_idx on public.stock_checks(user_id, item_id, checked_on desc);

create table public.shopping_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  item_id uuid references public.shopping_items(id) on delete cascade,
  -- Stage suggestions (phase 3) are keyed by a stable id instead of an item ("stage:solids:<child>").
  stage_key text check (stage_key is null or char_length(stage_key) <= 120),
  name text not null check (char_length(name) between 1 and 120),
  packs smallint not null default 1 check (packs between 1 and 50),
  est_amount bigint check (est_amount is null or est_amount >= 0),
  reason text not null default 'manual' check (reason in ('running_low','stage','manual','sale')),
  status text not null default 'planned' check (status in ('planned','bought','skipped')),
  created_at timestamptz not null default now()
);
create index shopping_plan_user_month_idx on public.shopping_plan_entries(user_id, month);

create table public.shopping_tx_dismissed (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.money_transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, transaction_id)
);

alter table public.stock_checks enable row level security;
alter table public.shopping_plan_entries enable row level security;
alter table public.shopping_tx_dismissed enable row level security;
create policy "Own stock checks" on public.stock_checks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own shopping plan" on public.shopping_plan_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own dismissed transactions" on public.shopping_tx_dismissed for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.stock_checks, public.shopping_plan_entries, public.shopping_tx_dismissed from anon;
