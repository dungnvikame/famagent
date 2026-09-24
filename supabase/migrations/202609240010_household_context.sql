-- Household context from onboarding v3: what the family wants help with (focus), household setup, rough monthly
-- spend (seeds the Money plan) and usual merchants. Add-only jsonb; validated in the app (validate.ts).
alter table public.family_profiles add column if not exists household jsonb not null default '{}'::jsonb;
