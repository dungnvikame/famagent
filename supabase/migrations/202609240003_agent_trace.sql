-- Agent trace + rejection reasons (SPEC_V1 §9, §16, §20). Add-only; no existing data is rewritten.
-- Back up before applying on environments with data:
--   pg_dump --schema-only -t public.recommendation_sessions -t public.recommendation_items "$DATABASE_URL" > backup-reco-schema.sql
-- Order: apply after 202609240002, then deploy the app code that writes these columns/tables.

-- Which products the hard filter removed and why (reason codes only, e.g. {"productId":"p1","reasons":["price_total"]}).
alter table public.recommendation_sessions add column rejected_products jsonb not null default '[]'::jsonb;
-- Score formula version per item so results can be reproduced (spec v1 §11.3, §16).
alter table public.recommendation_items add column score_version text;

-- One row per agent turn: state machine steps with timings and counts. No prompts or message text
-- are stored (spec v1 §20: trace metadata only, never personal content).
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  final_state text not null check (char_length(final_state) <= 40),
  algorithm_version text not null,
  extractor_mode text not null check (extractor_mode in ('ai','rules')),
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index agent_runs_user_created_idx on public.agent_runs(user_id, created_at desc);
alter table public.agent_runs enable row level security;
create policy "Read own agent runs" on public.agent_runs for select to authenticated using (user_id = auth.uid());
create policy "Insert own agent runs" on public.agent_runs for insert to authenticated with check (
  user_id = auth.uid()
  and (conversation_id is null or exists(select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
);
