-- Travel module (plan 261010-1335-travel-feature): family trips with an itinerary, a packing checklist and
-- expenses that mirror into the money ledger (source 'trip', linked by transaction_id — never counted twice).
-- Additive and idempotent. Back up before applying; apply BEFORE deploying the code that reads these tables.

create table if not exists public.travel_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  destination text not null check (char_length(destination) between 1 and 120),
  dest_type text not null default 'other' check (dest_type in ('beach','mountain','city','hometown','abroad','other')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'planning' check (status in ('planning','ongoing','done','cancelled')),
  budget_amount bigint not null default 0 check (budget_amount >= 0),
  -- Percent per expense bucket, e.g. {"transport":35,"lodging":25,"food":25,"activity":10,"misc":5}.
  budget_split jsonb not null default '{}'::jsonb,
  -- Member ids as in member_avatars (child uuid or adult id); empty = the whole family.
  member_ids jsonb not null default '[]'::jsonb,
  -- Booking links the family wants at hand: [{"label":"Vé VietJet","url":"https://…"}].
  links jsonb not null default '[]'::jsonb,
  goal_id uuid,
  -- T-7/T-2/T+1 reminders are on by default; the family can switch one trip off (plan decision #3).
  push_enabled boolean not null default true,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists travel_trips_user_idx on public.travel_trips(user_id, start_date desc);

create table if not exists public.travel_itinerary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  -- Null = not scheduled yet (kept when the trip dates change and the old day falls outside the range).
  day_date date,
  position smallint not null default 0 check (position between 0 and 200),
  time_label text check (time_label is null or char_length(time_label) <= 20),
  title text not null check (char_length(title) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  url text check (url is null or char_length(url) <= 500),
  est_amount bigint not null default 0 check (est_amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists travel_itinerary_trip_idx on public.travel_itinerary_entries(trip_id, day_date, position);
create index if not exists travel_itinerary_user_idx on public.travel_itinerary_entries(user_id);

create table if not exists public.travel_packing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  qty smallint not null default 1 check (qty between 1 and 99),
  category text not null default 'other' check (category in ('clothes','kids','health','documents','electronics','food','other')),
  -- member_id as in member_avatars: child uuid or adult id; null = the whole family.
  member_id text check (member_id is null or member_id ~ '^[a-z0-9-]{1,40}$'),
  status text not null default 'todo' check (status in ('todo','packed','buy_there')),
  source text not null default 'manual' check (source in ('manual','template','ai')),
  created_at timestamptz not null default now()
);
create index if not exists travel_packing_trip_idx on public.travel_packing_items(trip_id, category);
create index if not exists travel_packing_user_idx on public.travel_packing_items(user_id);

create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  occurred_on date not null,
  content text not null check (char_length(content) between 1 and 120),
  bucket text not null default 'misc' check (bucket in ('transport','lodging','food','activity','misc')),
  amount bigint not null check (amount >= 0),
  paid_from text check (paid_from is null or char_length(paid_from) <= 40),
  -- The mirrored ledger row; unique so the same expense can never be counted twice in the ledger.
  transaction_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists travel_expenses_tx_once on public.travel_expenses(transaction_id) where transaction_id is not null;
create index if not exists travel_expenses_trip_idx on public.travel_expenses(trip_id, occurred_on desc);
create index if not exists travel_expenses_user_idx on public.travel_expenses(user_id);

-- Trip reminders (T-7 prep, T-2 pack+documents, T+1 wrap-up): one send slot per family per trip per kind per day.
create table if not exists public.travel_push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  kind text not null check (kind in ('prep7','prep2','wrapup')),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id, kind, day)
);

do $$
declare t text;
begin
  foreach t in array array['travel_trips','travel_itinerary_entries','travel_packing_items','travel_expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own %s" on public.%I', t, t);
    execute format('create policy "Own %s" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

alter table public.travel_push_log enable row level security;
drop policy if exists "Read own travel push log" on public.travel_push_log;
create policy "Read own travel push log" on public.travel_push_log for select to authenticated using (user_id = auth.uid());
revoke all on public.travel_push_log from anon;

-- The money ledger accepts trip expenses as their own source (mirrored rows, Đợt 3).
alter table public.money_transactions drop constraint if exists money_transactions_source_check;
alter table public.money_transactions add constraint money_transactions_source_check check (source in ('manual','recurring','purchase','trip'));

-- The event log learns about trip expense writes.
alter table public.family_events drop constraint if exists family_events_type_check;
alter table public.family_events add constraint family_events_type_check check (type in ('PURCHASE_COMPLETED','PURCHASE_REMOVED','TRANSACTION_ADDED','NOTE_RECORDED','TRIP_EXPENSE_RECORDED'));

-- The reminder cron (role famagent_app) reads trips + packing and claims send slots in the push log.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'famagent_app') then
    grant select on public.travel_trips, public.travel_packing_items to famagent_app;
    drop policy if exists "Reminder job reads travel trips" on public.travel_trips;
    create policy "Reminder job reads travel trips" on public.travel_trips for select to famagent_app using (true);
    drop policy if exists "Reminder job reads travel packing" on public.travel_packing_items;
    create policy "Reminder job reads travel packing" on public.travel_packing_items for select to famagent_app using (true);
    grant select, insert, delete on public.travel_push_log to famagent_app;
    drop policy if exists "Reminder job reads travel push log" on public.travel_push_log;
    create policy "Reminder job reads travel push log" on public.travel_push_log for select to famagent_app using (true);
    drop policy if exists "Reminder job writes travel push log" on public.travel_push_log;
    create policy "Reminder job writes travel push log" on public.travel_push_log for insert to famagent_app with check (true);
    drop policy if exists "Reminder job releases travel push log" on public.travel_push_log;
    create policy "Reminder job releases travel push log" on public.travel_push_log for delete to famagent_app using (true);
  end if;
end $$;
