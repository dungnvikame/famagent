-- Offer snapshots + compare quota + analytics views (SPEC_V1 §16–17, plan P7). Add-only: new table, function,
-- views and a widened check constraint; no data is rewritten.
-- Back up first on environments with data:
--   pg_dump --schema-only "$DATABASE_URL" > backup-before-202609240005.sql
-- Order: after 202609240004; deploy before the P7 code (chat persistence calls record_offer_snapshots,
-- /api/compare uses the 'compare' quota).

-- AI compare summaries get their own hourly bucket.
alter table public.api_request_limits drop constraint api_request_limits_endpoint_check;
alter table public.api_request_limits add constraint api_request_limits_endpoint_check
  check (endpoint in ('chat', 'onboarding', 'compare'));

create or replace function public.consume_request_quota(p_endpoint text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  if auth.uid() is null or p_endpoint not in ('chat', 'onboarding', 'compare') or p_limit < 1 or p_limit > 200 then
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
revoke all on function public.consume_request_quota(text, integer) from public;
grant execute on function public.consume_request_quota(text, integer) to authenticated;

-- Price/availability exactly as stored when a recommendation was made; never updated afterwards.
create table public.offer_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
  product_id text not null references public.products(id),
  variant_id text not null references public.product_variants(id),
  offer_id text not null references public.product_offers(id),
  price integer not null check (price > 0),
  availability text not null check (availability in ('in_stock', 'out_of_stock', 'unknown')),
  price_observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (session_id, offer_id)
);
create index offer_snapshots_offer_idx on public.offer_snapshots(offer_id, created_at);
alter table public.offer_snapshots enable row level security;
-- Owner may read. No insert/update policy: rows are written only by record_offer_snapshots(), which copies
-- the values from product_offers, so a client cannot forge prices. Deleting the session cascades.
create policy "Read own offer snapshots" on public.offer_snapshots for select to authenticated
  using (exists (select 1 from public.recommendation_sessions s where s.id = session_id and s.user_id = auth.uid()));

create or replace function public.record_offer_snapshots(p_session_id uuid, p_offer_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  written integer;
begin
  if auth.uid() is null or cardinality(p_offer_ids) > 10
     or not exists (select 1 from public.recommendation_sessions s where s.id = p_session_id and s.user_id = auth.uid()) then
    return 0;
  end if;
  insert into public.offer_snapshots (session_id, product_id, variant_id, offer_id, price, availability, price_observed_at)
  select p_session_id, v.product_id, v.id, o.id, o.price, o.availability, o.updated_at
  from public.product_offers o join public.product_variants v on v.id = o.product_variant_id
  where o.id = any(p_offer_ids) and o.price > 0
    -- only offers this session actually recommended
    and exists (select 1 from public.recommendation_items i where i.session_id = p_session_id and i.offer_id = o.id)
  on conflict (session_id, offer_id) do nothing;
  get diagnostics written = row_count;
  return written;
end;
$$;
revoke all on function public.record_offer_snapshots(uuid, text[]) from public;
grant execute on function public.record_offer_snapshots(uuid, text[]) to authenticated;

-- Dashboard views (read in the Supabase dashboard / SQL editor; not exposed to app roles).
-- security_invoker keeps RLS in force if a role is ever granted access.
create view public.analytics_funnel_daily with (security_invoker = true) as
select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, event_name,
       count(*) as events, count(distinct coalesce(user_id::text, anonymous_session_id)) as users
from public.analytics_events
where event_name in ('homepage_view', 'onboarding_started', 'onboarding_completed', 'ai_message_sent', 'recommendation_generated',
                     'product_clicked', 'compare_started', 'product_compared', 'offer_clicked')
group by 1, 2;

create view public.recommendation_quality_daily with (security_invoker = true) as
select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
       count(*) as sessions,
       count(*) filter (where cardinality(result_product_ids) = 0) as no_result_sessions,
       round(100.0 * count(*) filter (where cardinality(result_product_ids) = 0) / nullif(count(*), 0), 1) as no_result_pct
from public.recommendation_sessions
group by 1;

-- Steps are {state, ms} deltas; malformed rows count as 0 instead of failing the whole view.
create view public.agent_latency_daily with (security_invoker = true) as
select day, count(*) as runs,
       percentile_cont(0.5) within group (order by total_ms) as p50_ms,
       percentile_cont(0.95) within group (order by total_ms) as p95_ms
from (
  select (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
         case when jsonb_typeof(r.steps) = 'array' then coalesce((
           select sum((step->>'ms')::numeric) from jsonb_array_elements(r.steps) as step
           where jsonb_typeof(step->'ms') = 'number'), 0) else 0 end as total_ms
  from public.agent_runs r
) runs
group by day;

create view public.affiliate_clicks_daily with (security_invoker = true) as
select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, merchant_id,
       count(*) as clicks, count(distinct coalesce(user_id::text, session_id)) as visitors
from public.affiliate_clicks
group by 1, 2;

revoke all on public.analytics_funnel_daily, public.recommendation_quality_daily, public.agent_latency_daily, public.affiliate_clicks_daily from anon, authenticated;
