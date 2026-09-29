-- "Nhắc cân đo định kỳ" push (plan 260929-1508): the daily reminder job also pushes when a child is due for
-- weighing / measuring, at most once a week per child. measure_push_log makes "once per child per day" atomic
-- (push_log is tied to shopping items). The job (DATABASE_URL role famagent_app) reads child_weights for the
-- last measurement days. Additive and idempotent; apply BEFORE deploying the cron change.

create table if not exists public.measure_push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, child_id, day)
);
alter table public.measure_push_log enable row level security;
drop policy if exists "Read own measure push log" on public.measure_push_log;
create policy "Read own measure push log" on public.measure_push_log for select to authenticated using (user_id = auth.uid());
revoke all on public.measure_push_log from anon;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'famagent_app') then
    grant select on public.child_weights to famagent_app;
    drop policy if exists "Reminder job reads child_weights" on public.child_weights;
    create policy "Reminder job reads child_weights" on public.child_weights for select to famagent_app using (true);
    grant select, insert, delete on public.measure_push_log to famagent_app;
    drop policy if exists "Reminder job reads measure push log" on public.measure_push_log;
    create policy "Reminder job reads measure push log" on public.measure_push_log for select to famagent_app using (true);
    drop policy if exists "Reminder job writes measure push log" on public.measure_push_log;
    create policy "Reminder job writes measure push log" on public.measure_push_log for insert to famagent_app with check (true);
    drop policy if exists "Reminder job releases measure push log" on public.measure_push_log;
    create policy "Reminder job releases measure push log" on public.measure_push_log for delete to famagent_app using (true);
  end if;
end $$;
