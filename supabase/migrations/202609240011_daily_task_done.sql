-- "Việc hôm nay" ticks, synced across the family's devices. The task list itself is computed from the profile and the
-- date (lib/brief/daily-tasks), so only completions are stored. Add-only; RLS per user; anon revoked.
create table public.daily_task_done (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  task_id text not null check (char_length(task_id) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, day, task_id)
);

alter table public.daily_task_done enable row level security;
create policy "Own daily task ticks" on public.daily_task_done for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.daily_task_done from anon;
