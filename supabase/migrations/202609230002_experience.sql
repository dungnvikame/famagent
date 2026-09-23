-- Full MVP data model. Guest demo keeps profile/history in browser until auth is configured.
create table public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  adults_count smallint check (adults_count between 1 and 10),
  price_preference text not null default 'balanced' check (price_preference in ('budget','balanced','premium')),
  main_concern text check (main_concern in ('night','leak','soft','sensitive','value')),
  max_budget integer check (max_budget > 0),
  ai_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_profile_id uuid not null references public.family_profiles(id) on delete cascade,
  name text,
  birth_date date,
  current_weight_kg numeric(5,2) check (current_weight_kg between 2 and 30),
  diaper_size text check (diaper_size in ('NB','S','M','L','XL','XXL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.shopping_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  intent jsonb not null,
  extractor_mode text not null check (extractor_mode in ('ai','rules')),
  created_at timestamptz not null default now()
);

create table public.recommendation_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  intent jsonb not null,
  candidate_product_ids text[] not null default '{}',
  result_product_ids text[] not null default '{}',
  ranking_version text not null,
  created_at timestamptz not null default now()
);

create table public.recommendation_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
  product_id text not null references public.products(id),
  offer_id text references public.product_offers(id),
  rank smallint not null check (rank between 1 and 5),
  total_score smallint not null check (total_score between 0 and 100),
  component_scores jsonb not null,
  reasons jsonb not null,
  unique(session_id, rank)
);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  product_id text not null references public.products(id),
  offer_id text not null references public.product_offers(id),
  merchant_id text not null references public.merchants(id),
  destination_url text not null,
  created_at timestamptz not null default now()
);

create table public.saved_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  event_name text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index children_family_idx on public.children(family_profile_id);
create index messages_conversation_idx on public.messages(conversation_id,created_at);
create index recommendations_conversation_idx on public.recommendation_sessions(conversation_id,created_at);
create index affiliate_clicks_session_idx on public.affiliate_clicks(session_id,created_at);
create index analytics_events_name_time_idx on public.analytics_events(event_name,created_at);

alter table public.family_profiles enable row level security;
alter table public.children enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.shopping_intents enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.recommendation_items enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.saved_products enable row level security;
alter table public.analytics_events enable row level security;

create policy "Own family profile" on public.family_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own children" on public.children for all to authenticated using (exists(select 1 from public.family_profiles f where f.id = family_profile_id and f.user_id = auth.uid())) with check (exists(select 1 from public.family_profiles f where f.id = family_profile_id and f.user_id = auth.uid()));
create policy "Own conversations" on public.conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own messages" on public.messages for all to authenticated using (exists(select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())) with check (exists(select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "Own intents" on public.shopping_intents for all to authenticated using (exists(select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())) with check (exists(select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "Own saved products" on public.saved_products for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Recommendation logs, click logs and analytics are server-write only until authenticated APIs are added.

