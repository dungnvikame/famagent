-- Core journey (plans/260924-1626-core-journey-mvp): feedback on insights ("Hữu ích / Không đúng / Chưa cần / Đừng nhắc
-- việc này nữa") and one notification log for every reminder kind (push_log stays for item reminders already sent).
-- Add-only. Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-attention.sql

create table public.insight_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- kind:subject, e.g. "stock_low:<item id>", "money_pace:2026-09".
  key text not null check (char_length(key) between 3 and 200),
  verdict text not null check (verdict in ('useful','wrong','later','mute')),
  until date,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Written by the daily/weekly jobs: one row per (family, insight key, day) makes "at most once a day" atomic.
create table public.notification_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 3 and 200),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key, day)
);

alter table public.insight_feedback enable row level security;
alter table public.notification_log enable row level security;
create policy "Own insight feedback" on public.insight_feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Read own notification log" on public.notification_log for select to authenticated using (user_id = auth.uid());
revoke all on public.insight_feedback, public.notification_log from anon;

-- The reminder jobs (DATABASE_URL role famagent_app, when present) read feedback, the ledger and plan, and write the log.
-- Nothing else: conversations/messages stay unreadable to the server role.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_roles where rolname = 'famagent_app') then
    foreach t in array array['insight_feedback', 'notification_log', 'money_transactions', 'money_recurring', 'money_budgets', 'money_goals', 'money_settings', 'shopping_plan_entries'] loop
      execute format('grant select on public.%I to famagent_app', t);
      execute format('create policy "Reminder job reads %s" on public.%I for select to famagent_app using (true)', t, t);
    end loop;
    grant insert, delete on public.notification_log to famagent_app;
    create policy "Reminder job writes notification log" on public.notification_log for insert to famagent_app with check (true);
    create policy "Reminder job releases notification log" on public.notification_log for delete to famagent_app using (true);
  end if;
end $$;
