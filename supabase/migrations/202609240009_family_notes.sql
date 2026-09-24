-- Family notes (SPEC_V2 §31 shared memory): facts pulled from conversations, saved automatically as
-- "recorded" (UI label "Ghi nhận") until the family confirms or deletes them. Feeds recommendations
-- (health notes about a brand exclude it). Add-only; RLS per user.

create table public.family_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 3 and 160),
  kind text not null check (kind in ('health','habit','preference','other')),
  status text not null default 'recorded' check (status in ('recorded','confirmed')),
  brand text check (brand is null or char_length(brand) <= 80),
  child_id uuid references public.children(id) on delete set null,
  source_conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index family_notes_user_idx on public.family_notes(user_id, created_at desc);

alter table public.family_notes enable row level security;
create policy "Own family notes" on public.family_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.family_notes from anon;
