-- Shopping phase 4 (plans/260924-1431-shopping-plan-redesign): an hourly quota for order-photo reading, Web Push
-- subscriptions for "sắp hết" reminders, and a log so each item is pushed at most once a day. Add-only.
-- Back up before applying: pg_dump --schema-only "$DATABASE_URL" > backup-pre-receipt-push.sql

alter table public.api_request_limits drop constraint api_request_limits_endpoint_check;
alter table public.api_request_limits add constraint api_request_limits_endpoint_check
  check (endpoint in ('chat', 'onboarding', 'compare', 'receipt'));

create or replace function public.consume_request_quota(p_endpoint text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  if auth.uid() is null or p_endpoint not in ('chat', 'onboarding', 'compare', 'receipt') or p_limit < 1 or p_limit > 200 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_endpoint));
  select count(*) into used from public.api_request_limits
    where user_id = auth.uid() and endpoint = p_endpoint and created_at > now() - interval '1 hour';
  if used >= p_limit then
    return false;
  end if;
  insert into public.api_request_limits (user_id, endpoint) values (auth.uid(), p_endpoint);
  return true;
end;
$$;
revoke all on function public.consume_request_quota(text, integer) from public, anon;
grant execute on function public.consume_request_quota(text, integer) to authenticated;

-- One row per browser/device that allowed notifications. Keys are the browser's public push keys (not secrets).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
-- Per user: a shared device that switches accounts gets a row per account instead of a cross-user conflict.
create unique index push_subscriptions_user_endpoint on public.push_subscriptions(user_id, endpoint);

-- Written by the daily reminder job (server, DATABASE_URL); the primary key makes "once per item per day" atomic.
create table public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.shopping_items(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, day)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Read own push log" on public.push_log for select to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions, public.push_log from anon;
