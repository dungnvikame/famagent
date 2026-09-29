import { expectedAmount, recurringAmountsFrom } from "./fixed-items.ts";
import type { MoneyDebt, MoneyRecurring, MoneyTransaction, RecurringPeriod } from "./types.ts";

/**
 * Answering one period of a fixed item ("Đã trả?"): what the ledger entry and the period record look like.
 * Pure and shared by the Supabase store and the browser-only store, so both behave the same.
 */

export const CONFIRMED_MESSAGE = "Kỳ này đã được xác nhận.";
export const MISSING_ITEM_MESSAGE = "Không tìm thấy khoản cố định.";

/** Everything after `status` shapes the ledger entry a "paid" answer writes (a matched hand-typed entry keeps its own fields). */
export interface ConfirmInput { recurringId: string; period: string; status: "paid" | "skipped"; occurredOn?: string; amount?: number; content?: string; category?: string; debtId?: string; forChild?: boolean; childId?: string; paidFrom?: "savings"; note?: string }

/** A stored answer: the period plus the ledger entry it created (undo deletes it). */
export interface PeriodRecord extends RecurringPeriod { transactionId?: string }

/** The record, and for "paid" the ledger entry, that answer `input` for `item`. */
export function planConfirmation(item: MoneyRecurring, input: ConfirmInput, ctx: { amounts?: Record<string, number[]>; debts: MoneyDebt[]; today: string; transactionId: string }): { record: PeriodRecord; transaction?: MoneyTransaction } {
  if (input.status === "skipped") return { record: { recurringId: item.id, period: input.period, status: "skipped" } };
  const amount = input.amount ?? expectedAmount(item, ctx.amounts).amount;
  const occurredOn = input.occurredOn ?? ctx.today;
  // A payment of a debt whose linked item this is counts against that debt unless the family picked another one.
  const debtId = item.kind === "expense" ? input.debtId ?? ctx.debts.find((debt) => debt.recurringId === item.id)?.id : undefined;
  const transaction: MoneyTransaction = { id: ctx.transactionId, occurredOn, content: input.content ?? item.name, category: input.category ?? item.category, kind: item.kind, amount, forChild: input.forChild === true, childId: input.forChild === true ? input.childId : undefined, note: input.note, source: "recurring", recurringId: item.id, paidFrom: item.kind === "expense" && input.paidFrom === "savings" ? "savings" : undefined, debtId };
  return { record: { recurringId: item.id, period: input.period, status: "paid", paidOn: occurredOn, amount, transactionId: transaction.id }, transaction };
}

/** What the browser-only store keeps: the fixed items, the ledger and the period answers. Mutated in place. */
export interface LocalPeriodData { recurring: MoneyRecurring[]; transactions: MoneyTransaction[]; periods: PeriodRecord[]; settings: { position?: { debts: MoneyDebt[] } } }

/** Local-mode confirm with the server's semantics: a second answer for the same period is rejected. */
export function confirmLocal(data: LocalPeriodData, input: ConfirmInput, today: string, transactionId: string): { transaction?: MoneyTransaction } {
  const item = data.recurring.find((entry) => entry.id === input.recurringId);
  if (!item) throw new Error(MISSING_ITEM_MESSAGE);
  if (data.periods.some((record) => record.recurringId === item.id && record.period === input.period)) throw new Error(CONFIRMED_MESSAGE);
  const { record, transaction } = planConfirmation(item, input, { amounts: recurringAmountsFrom(data.transactions), debts: data.settings.position?.debts ?? [], today, transactionId });
  data.periods.push(record);
  if (transaction) data.transactions.push(transaction);
  return { transaction };
}

/** Removes the answer and the ledger entry it created; nothing to undo is not an error. */
export function undoLocal(data: LocalPeriodData, recurringId: string, period: string): void {
  const record = data.periods.find((entry) => entry.recurringId === recurringId && entry.period === period);
  if (!record) return;
  if (record.transactionId) data.transactions = data.transactions.filter((tx) => tx.id !== record.transactionId);
  data.periods = data.periods.filter((entry) => entry !== record);
}
