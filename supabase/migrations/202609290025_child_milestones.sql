-- Development milestones (plan 260929-1508): what the family marked per child — "done" (with the day) or "not_yet".
-- Ids are the app's CDC / WHO milestone ids (lib/family/milestones-data.ts). One row per child per milestone.
-- Additive and idempotent; apply BEFORE deploying the code that reads it.
create table if not exists public.child_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  milestone_id text not null check (milestone_id ~ '^(m[0-9]{1,2}-[slcm][0-9]{1,2}|who-[a-z-]{2,30})$'),
  status text not null check (status in ('done','not_yet')),
  achieved_on date,
  updated_at timestamptz not null default now(),
  primary key (child_id, milestone_id)
);
create index if not exists child_milestones_user_idx on public.child_milestones(user_id);
alter table public.child_milestones enable row level security;
drop policy if exists "Own child milestones" on public.child_milestones;
create policy "Own child milestones" on public.child_milestones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.child_milestones from anon;
