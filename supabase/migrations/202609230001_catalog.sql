-- Milestone 1–2: chỉ catalog bỉm. Dùng migration làm nguồn chuẩn của schema.
create table public.categories (
  slug text primary key,
  name text not null
);

create table public.products (
  id text primary key,
  slug text not null unique,
  canonical_name text not null,
  brand text not null,
  category_slug text not null references public.categories(slug),
  description text,
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_product_has_image check (not published or image_url is not null)
);

create table public.diaper_attributes (
  product_id text primary key references public.products(id) on delete cascade,
  min_weight_kg numeric(5,2) not null check (min_weight_kg > 0),
  max_weight_kg numeric(5,2) not null check (max_weight_kg >= min_weight_kg),
  diaper_type text not null check (diaper_type in ('tape', 'pants')),
  night_use_score smallint check (night_use_score between 1 and 5),
  absorbency_score smallint check (absorbency_score between 1 and 5),
  softness_score smallint check (softness_score between 1 and 5),
  thickness_score smallint check (thickness_score between 1 and 5),
  sensitive_skin_score smallint check (sensitive_skin_score between 1 and 5)
);

create table public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  quantity_unit text not null default 'piece' check (quantity_unit = 'piece'),
  sku text,
  gtin text,
  unique (product_id, size, quantity)
);

create table public.merchants (
  id text primary key,
  name text not null,
  type text not null check (type in ('marketplace', 'brand', 'affiliate', 'supplier')),
  domain text,
  created_at timestamptz not null default now()
);

create table public.product_offers (
  id text primary key,
  product_variant_id text not null references public.product_variants(id) on delete cascade,
  merchant_id text not null references public.merchants(id),
  source text not null check (source in ('shopee', 'tiktok', 'lazada', 'affiliate', 'direct')),
  price integer not null check (price > 0),
  original_price integer check (original_price is null or original_price >= price),
  currency text not null default 'VND' check (currency = 'VND'),
  availability text not null check (availability in ('in_stock', 'out_of_stock', 'unknown')),
  affiliate_url text,
  seller_rating numeric(3,2) check (seller_rating between 0 and 5),
  seller_review_count integer check (seller_review_count >= 0),
  shipping_estimate text,
  updated_at timestamptz not null default now(),
  constraint active_offer_has_url check (availability <> 'in_stock' or affiliate_url is not null)
);

create index products_category_brand_idx on public.products(category_slug, brand) where published;
create index diaper_weight_idx on public.diaper_attributes(min_weight_kg, max_weight_kg);
create index variants_size_idx on public.product_variants(size);
create index offers_price_idx on public.product_offers(price) where availability = 'in_stock';

insert into public.categories(slug, name) values ('diapers', 'Bỉm cho bé');

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.diaper_attributes enable row level security;
alter table public.product_variants enable row level security;
alter table public.merchants enable row level security;
alter table public.product_offers enable row level security;

create policy "Read categories" on public.categories for select to anon, authenticated using (true);
create policy "Read published products" on public.products for select to anon, authenticated using (published);
create policy "Read published diaper attributes" on public.diaper_attributes for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.published));
create policy "Read published variants" on public.product_variants for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.published));
create policy "Read merchants" on public.merchants for select to anon, authenticated using (true);
create policy "Read offers for published products" on public.product_offers for select to anon, authenticated using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = product_variant_id and p.published));

-- Chỉ cấp các cột an toàn cho client. URL hoa hồng chỉ được backend đọc trong milestone affiliate.
revoke all on public.product_offers from anon, authenticated;
grant select (id, product_variant_id, merchant_id, source, price, original_price, currency, availability, seller_rating, seller_review_count, shipping_estimate, updated_at) on public.product_offers to anon, authenticated;

