-- Supabase grants EXECUTE on new public functions to anon directly (default privileges), so the earlier
-- "revoke ... from public" did not remove it. Both functions already return false/0 without auth.uid();
-- this closes the RPC endpoint for signed-out callers (Supabase advisor 0028). Permissions only, no data change.
revoke execute on function public.consume_request_quota(text, integer) from anon;
revoke execute on function public.record_offer_snapshots(uuid, text[]) from anon;
