-- Per-variant weight range: a size line (M 6-11, L 9-14, XL 12-17) has one range per size, not per product.
-- Nullable: rows without it keep using diaper_attributes.min_weight_kg/max_weight_kg (code falls back).
alter table public.product_variants
  add column if not exists weight_min_kg numeric(5,2) check (weight_min_kg is null or weight_min_kg > 0),
  add column if not exists weight_max_kg numeric(5,2);

alter table public.product_variants drop constraint if exists variant_weight_range_valid;
alter table public.product_variants
  add constraint variant_weight_range_valid check (
    (weight_min_kg is null and weight_max_kg is null)
    or (weight_min_kg is not null and weight_max_kg is not null and weight_max_kg >= weight_min_kg)
  );
