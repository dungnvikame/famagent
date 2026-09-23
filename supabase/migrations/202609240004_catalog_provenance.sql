-- Catalog provenance (SPEC_V1 §10.2–10.3, plan P6): quality scores must carry their source.
-- Add-only. Back up first on environments with data:
--   pg_dump --schema-only -t public.diaper_attributes "$DATABASE_URL" > backup-diaper-attributes-schema.sql
-- Order: after 202609240003; required before running the new import-products.mjs (it writes these columns).

alter table public.diaper_attributes
  add column attribute_source text check (char_length(attribute_source) <= 300),
  add column attribute_verified_at timestamptz;

-- A quality score without a recorded source is not allowed from now on (existing rows are unaffected
-- until they are re-imported, because the check is NOT VALID for old data).
alter table public.diaper_attributes add constraint diaper_scores_need_source check (
  attribute_source is not null or (night_use_score is null and absorbency_score is null and softness_score is null and thickness_score is null and sensitive_skin_score is null)
) not valid;
