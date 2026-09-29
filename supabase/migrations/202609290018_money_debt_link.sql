-- A repayment can name the Tình hình debt it pays down (29/09/2026), so the debt's remaining balance goes down for
-- every repayment, not only for the ones its linked recurring item posts. Additive and nullable: existing rows keep
-- null. The debt id lives in money_settings.position (jsonb), not in a table, so there is no foreign key.
alter table public.money_transactions
  add column if not exists debt_id text;

comment on column public.money_transactions.debt_id is
  'Expense only: id of the debt in money_settings.position.debts that this payment reduces (null = not a debt payment, or paid through the debt''s recurring item).';
