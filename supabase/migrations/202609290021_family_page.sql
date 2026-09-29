-- Family page redesign (plan 260929-1508): weight history per child (growth chart) and member avatar photos.
-- Adults, emoji/colour looks, motto and cover theme live in family_profiles.household (jsonb): no column needed.
-- Additive and idempotent. Back up before applying; apply BEFORE deploying the code that reads these tables.

create table if not exists public.child_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(4,1) not null check (weight_kg >= 1 and weight_kg <= 40),
  created_at timestamptz not null default now(),
  -- One weighing per child per day: a second entry the same day replaces the first.
  unique (child_id, measured_on)
);
create index if not exists child_weights_user_idx on public.child_weights(user_id, measured_on);

alter table public.child_weights enable row level security;
drop policy if exists "Own child weights" on public.child_weights;
create policy "Own child weights" on public.child_weights for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.child_weights from anon;

-- A square JPEG data URL (≤256 px, shrunk in the browser) per family member; member_id = child uuid or adult id.
create table if not exists public.member_avatars (
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id text not null check (member_id ~ '^[a-z0-9-]{1,40}$'),
  image text not null check (image like 'data:image/jpeg;base64,%' and length(image) <= 120000),
  updated_at timestamptz not null default now(),
  primary key (user_id, member_id)
);

alter table public.member_avatars enable row level security;
drop policy if exists "Own member avatars" on public.member_avatars;
create policy "Own member avatars" on public.member_avatars for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.member_avatars from anon;
