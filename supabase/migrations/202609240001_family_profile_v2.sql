-- Family Profile v2: full household context (SOURCE_SPEC §12–13) + confirmed-value provenance (SPEC_V1 §6.1).
-- Add-only: no column is dropped or rewritten. Order: back up → apply this migration → THEN deploy the app code
-- (the code writes these new columns; deploying first makes PUT /api/me fail with 500). Backup:
--   pg_dump --data-only -t public.family_profiles -t public.children -t public.api_request_limits "$DATABASE_URL" > backup-family-v1.sql
-- Constraint names below are Postgres defaults for inline column checks (<table>_<column>_check); verify with \d if migrations were edited.

alter table public.family_profiles
  add column delivery_preference text check (delivery_preference in ('cheapest','fastest','balanced')),
  add column preferred_brands text[] not null default '{}' check (cardinality(preferred_brands) <= 10),
  add column avoided_ingredients text[] not null default '{}' check (cardinality(avoided_ingredients) <= 10),
  add column washing_machine text check (washing_machine in ('front','top','none')),
  add column onboarding jsonb not null default '{}'::jsonb,
  add column field_meta jsonb not null default '{}'::jsonb;

alter table public.family_profiles drop constraint family_profiles_price_preference_check;
alter table public.family_profiles add constraint family_profiles_price_preference_check
  check (price_preference in ('budget','value','balanced','premium'));

alter table public.children
  add column sensitivities text[] not null default '{}' check (sensitivities <@ array['sensitive_skin','rash_prone','fragrance_free']::text[]),
  add column current_brand text check (char_length(current_brand) <= 40),
  add column preferred_brands text[] not null default '{}' check (cardinality(preferred_brands) <= 10),
  add column disliked_brands text[] not null default '{}' check (cardinality(disliked_brands) <= 10);

-- Anonymous (guest) users count onboarding LLM turns in the same table as chat (plan D5).
alter table public.api_request_limits drop constraint api_request_limits_endpoint_check;
alter table public.api_request_limits add constraint api_request_limits_endpoint_check
  check (endpoint in ('chat','onboarding'));
