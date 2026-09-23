alter table public.children add column age_months smallint check (age_months between 0 and 216);
alter table public.children add column position smallint not null default 0 check (position between 0 and 4);
alter table public.family_profiles add column onboarded_at timestamptz;
alter table public.messages add column metadata jsonb not null default '{}';

create policy "Own recommendation sessions" on public.recommendation_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own recommendation items" on public.recommendation_items for all to authenticated
  using (exists (select 1 from public.recommendation_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.recommendation_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "Own analytics events" on public.analytics_events for insert to authenticated
  with check (user_id = auth.uid());
create policy "Read own analytics events" on public.analytics_events for select to authenticated using (user_id = auth.uid());
create policy "Delete own analytics events" on public.analytics_events for delete to authenticated
  using (user_id = auth.uid());
create policy "Read own affiliate clicks" on public.affiliate_clicks for select to authenticated using (user_id = auth.uid());
create policy "Delete own affiliate clicks" on public.affiliate_clicks for delete to authenticated
  using (user_id = auth.uid());

create index conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index saved_products_user_idx on public.saved_products(user_id);

create table public.api_request_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in ('chat')),
  created_at timestamptz not null default now()
);
create index api_request_limits_lookup_idx on public.api_request_limits(user_id, endpoint, created_at desc);
alter table public.api_request_limits enable row level security;
create policy "Own request limits" on public.api_request_limits for select to authenticated using (user_id = auth.uid());
create policy "Insert own request limits" on public.api_request_limits for insert to authenticated with check (user_id = auth.uid());
create policy "Delete own request limits" on public.api_request_limits for delete to authenticated using (user_id = auth.uid());
