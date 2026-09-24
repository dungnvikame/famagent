-- Money page upgrade (24/09/2026): current financial position, the family's own money split, and category
-- corrections remembered by quick add. All three live on the existing per-user settings row (RLS unchanged).
-- Additive only: nullable / defaulted columns, no data rewrite.

alter table public.money_settings
  -- { asOf: 'YYYY-MM-DD', accounts: [{ id, name, type, amount, note? }], debts: [{ id, name, balance, monthlyPayment?, dueDay?, ratePct?, note?, recurringId? }] }
  add column if not exists position jsonb,
  -- { buckets: [{ key, label, share (0–1), categories: [text] }] } for money method "custom"
  add column if not exists allocation jsonb,
  -- normalized content key → category, learned from the family's corrections in quick add
  add column if not exists category_memory jsonb not null default '{}'::jsonb;

alter table public.money_settings
  add constraint money_settings_position_object check (position is null or jsonb_typeof(position) = 'object'),
  add constraint money_settings_allocation_object check (allocation is null or jsonb_typeof(allocation) = 'object'),
  add constraint money_settings_memory_object check (jsonb_typeof(category_memory) = 'object');
