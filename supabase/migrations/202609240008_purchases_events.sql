-- Cross-module MVP (SPEC_V2 §29–30, §38): one PURCHASE_COMPLETED event updates Shopping (purchase history),
-- Finance (an expense in money_transactions) and Consumption (estimated stock). Processing happens in the
-- request that records the purchase; family_events is the append-only log the modules were fed from.
-- Add-only. Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-purchases.sql

create table public.family_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('PURCHASE_COMPLETED','PURCHASE_REMOVED','TRANSACTION_ADDED','NOTE_RECORDED')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index family_events_user_time_idx on public.family_events(user_id, created_at desc);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Catalog ids are text (demo products included); the name is copied so history survives catalog changes.
  product_id text not null check (char_length(product_id) <= 100),
  product_name text not null check (char_length(product_name) between 1 and 200),
  brand text check (brand is null or char_length(brand) <= 80),
  variant_id text check (variant_id is null or char_length(variant_id) <= 100),
  offer_id text check (offer_id is null or char_length(offer_id) <= 100),
  merchant text check (merchant is null or char_length(merchant) <= 80),
  amount bigint not null check (amount >= 0),
  -- Packs bought × pieces per pack = pieces added to stock.
  packs smallint not null default 1 check (packs between 1 and 50),
  unit_count integer not null check (unit_count between 1 and 100000),
  purchased_on date not null,
  child_id uuid references public.children(id) on delete set null,
  -- Pieces per day used for the stock estimate; null = default by the child's age.
  daily_rate numeric(6,2) check (daily_rate is null or daily_rate > 0),
  transaction_id uuid references public.money_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index purchases_user_product_idx on public.purchases(user_id, product_id, purchased_on desc);

alter table public.family_events enable row level security;
alter table public.purchases enable row level security;
create policy "Own family events" on public.family_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own purchases" on public.purchases for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.family_events, public.purchases from anon;
