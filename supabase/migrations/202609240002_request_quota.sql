-- Atomic LLM quota for chat and onboarding (plan D1/D5). No data is rewritten; policies and a function only.
-- Back up first on environments with data:
--   pg_dump --schema-only -t public.api_request_limits "$DATABASE_URL" > backup-request-limits-schema.sql
-- Order: apply after 202609240001, then deploy the app code that calls consume_request_quota().

-- Users must not be able to erase their own quota rows (direct PostgREST delete bypassed the limit).
-- Rows hold only user_id, endpoint and a timestamp; they are removed with the account (on delete cascade).
drop policy if exists "Delete own request limits" on public.api_request_limits;

-- Count-and-insert in one transaction, serialised per user+endpoint, so parallel requests cannot exceed the limit.
create or replace function public.consume_request_quota(p_endpoint text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  if auth.uid() is null or p_endpoint not in ('chat', 'onboarding') or p_limit < 1 or p_limit > 200 then
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
