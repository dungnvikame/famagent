-- Expense paid out of the savings fund instead of cash (25/09/2026): it still counts as spending, but reduces the
-- savings fund and does not add to "tiêu lẹm". Additive: existing rows default to 'cash'.
alter table public.money_transactions
  add column if not exists paid_from text not null default 'cash';

alter table public.money_transactions
  add constraint money_transactions_paid_from check (paid_from in ('cash', 'savings'));
