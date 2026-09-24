-- Shopping becomes "what our family uses" (plans/260924-1431-shopping-plan-redesign, phase 1): a purchase belongs to a
-- household item, not necessarily to a catalog product, so anything bought anywhere can be logged and forecast.
-- Add-only + backfill. Back up before applying: pg_dump "$DATABASE_URL" -t public.purchases > backup-pre-shopping-items.sql

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (category in ('diapers','wipes','milk','solids','hygiene','household','other')),
  -- What one unit is ("miếng", "tờ", "hộp"); pack_size = units per pack.
  unit text not null default 'gói' check (char_length(unit) between 1 and 20),
  pack_size integer check (pack_size is null or pack_size between 1 and 100000),
  brand text check (brand is null or char_length(brand) <= 80),
  merchant text check (merchant is null or char_length(merchant) <= 80),
  -- Units per day set by the family; null = learned from history or the default for the category.
  daily_rate numeric(8,3) check (daily_rate is null or daily_rate > 0),
  child_id uuid references public.children(id) on delete set null,
  -- Optional link to the catalog (diapers only today) for "find an alternative".
  product_id text check (product_id is null or char_length(product_id) <= 100),
  status text not null default 'active' check (status in ('active','paused','outgrown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_items_user_idx on public.shopping_items(user_id, status);

alter table public.purchases alter column product_id drop not null;
alter table public.purchases add column item_id uuid references public.shopping_items(id) on delete cascade;
alter table public.purchases add column source text not null default 'catalog' check (source in ('catalog','chat','quick','ledger','photo','plan'));

-- Backfill: one item per (user, catalog product), named after the latest purchase; the latest user-set rate moves to the item.
insert into public.shopping_items (user_id, name, category, unit, pack_size, brand, merchant, daily_rate, child_id, product_id)
select distinct on (p.user_id, p.product_id)
  p.user_id, p.product_name, 'diapers', 'miếng', greatest(1, p.unit_count / greatest(p.packs, 1)), p.brand, p.merchant,
  (select r.daily_rate from public.purchases r where r.user_id = p.user_id and r.product_id = p.product_id and r.daily_rate is not null order by r.purchased_on desc limit 1),
  p.child_id, p.product_id
from public.purchases p
order by p.user_id, p.product_id, p.purchased_on desc, p.created_at desc;

update public.purchases p set item_id = i.id
from public.shopping_items i
where p.item_id is null and i.user_id = p.user_id and i.product_id = p.product_id;

alter table public.purchases alter column item_id set not null;
create index purchases_user_item_idx on public.purchases(user_id, item_id, purchased_on desc);

alter table public.shopping_items enable row level security;
create policy "Own shopping items" on public.shopping_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.shopping_items from anon;
