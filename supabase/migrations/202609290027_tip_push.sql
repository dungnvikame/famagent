-- Daily "Mẹo hôm nay" push (plan 260929-1508): the 8:00 reminder job sends one age-guide tip per family per day.
-- tip_push_log makes "once per family per day" atomic; the job (DATABASE_URL role famagent_app) reads the tips the
-- family already tried from child_milestones. Additive and idempotent; apply BEFORE deploying the cron change.

create table if not exists public.tip_push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  tip_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.tip_push_log enable row level security;
drop policy if exists "Read own tip push log" on public.tip_push_log;
create policy "Read own tip push log" on public.tip_push_log for select to authenticated using (user_id = auth.uid());
revoke all on public.tip_push_log from anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'famagent_app') then
    grant select on public.child_milestones to famagent_app;
    drop policy if exists "Reminder job reads child_milestones" on public.child_milestones;
    create policy "Reminder job reads child_milestones" on public.child_milestones for select to famagent_app using (true);
    grant select, insert, delete on public.tip_push_log to famagent_app;
    drop policy if exists "Reminder job reads tip push log" on public.tip_push_log;
    create policy "Reminder job reads tip push log" on public.tip_push_log for select to famagent_app using (true);
    drop policy if exists "Reminder job writes tip push log" on public.tip_push_log;
    create policy "Reminder job writes tip push log" on public.tip_push_log for insert to famagent_app with check (true);
    drop policy if exists "Reminder job releases tip push log" on public.tip_push_log;
    create policy "Reminder job releases tip push log" on public.tip_push_log for delete to famagent_app using (true);
  end if;
end $$;
