import type { MoneyBundle, MoneyDebt, MoneyPosition, MoneyRecurring, MoneyTransaction } from "./types.ts";

/**
 * Current financial position ("Tình hình"): what the family has and owes on `asOf`, then the ledger moves it.
 * Balances stay `opening + all-time totals`; the position only decides the opening anchor, so every other
 * screen (summary, agent answers) keeps working unchanged.
 */

type Totals = { income: number; expense: number; saving: number };

export const accountTotals = (position: MoneyPosition) => ({
  cash: position.accounts.filter((item) => item.type !== "saving").reduce((sum, item) => sum + item.amount, 0),
  savings: position.accounts.filter((item) => item.type === "saving").reduce((sum, item) => sum + item.amount, 0),
});

/** Opening balances such that `opening + totals up to asOf` equals what the family said it had on `asOf`. */
export function anchorFromPosition(position: MoneyPosition, untilAsOf: Totals): { openingCash: number; openingSavings: number } {
  const { cash, savings } = accountTotals(position);
  return { openingCash: cash - (untilAsOf.income - untilAsOf.expense - untilAsOf.saving), openingSavings: savings - untilAsOf.saving };
}

/** Paid toward each debt through its linked recurring item after `asOf` (by debt id). */
export function debtPayments(debts: MoneyDebt[], asOf: string, transactions: Array<Pick<MoneyTransaction, "recurringId" | "occurredOn" | "amount" | "kind">>): Record<string, number> {
  const byRecurring = new Map(debts.filter((debt) => debt.recurringId).map((debt) => [debt.recurringId!, debt.id]));
  const since = new Map(debts.map((debt) => [debt.id, debt.asOf ?? asOf]));
  const paid: Record<string, number> = {};
  for (const tx of transactions) {
    const debtId = tx.recurringId ? byRecurring.get(tx.recurringId) : undefined;
    if (debtId && tx.kind === "expense" && tx.occurredOn > (since.get(debtId) ?? asOf)) paid[debtId] = (paid[debtId] ?? 0) + tx.amount;
  }
  return paid;
}

export const debtLeft = (debt: MoneyDebt, paid: Record<string, number> = {}) => Math.max(0, debt.balance - (paid[debt.id] ?? 0));

/** Months until a debt is paid off at its monthly payment (simple interest-free estimate when no rate is given). */
export function monthsToPayOff(left: number, monthly?: number, ratePct?: number): number | undefined {
  if (!monthly || monthly <= 0 || left <= 0) return left <= 0 ? 0 : undefined;
  const r = ratePct ? ratePct / 100 / 12 : 0;
  if (!r) return Math.ceil(left / monthly);
  if (monthly <= left * r) return undefined; // payment never covers the interest
  return Math.ceil(-Math.log(1 - (r * left) / monthly) / Math.log(1 + r));
}

export interface PositionSummary {
  has: number; cash: number; savings: number; owes: number; debtMonthly: number;
  fixedIncome: number; fixedExpense: number; income: number;
  /** Savings ÷ fixed monthly spend. */
  emergencyMonths?: number;
  debtRatio?: number; fixedRatio?: number;
  notes: Array<{ tone: "ok" | "warn"; text: string }>;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const short = (amount: number) => amount >= 1_000_000 ? `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr` : `${Math.round(amount / 1000)}k`;

/**
 * The numbers on the Tình hình tab. Income for ratios: fixed monthly income, else this month's logged income,
 * else the onboarding estimate. Debt payments are counted once even when they also sit in the recurring list.
 */
export function positionSummary(bundle: Pick<MoneyBundle, "settings" | "recurring" | "debtPaid">, balances: { cash: number; savings: number }, loggedIncome = 0, estimatedIncome = 0): PositionSummary {
  const position = bundle.settings.position;
  const debts = position?.debts ?? [];
  const active = bundle.recurring.filter((item: MoneyRecurring) => item.active);
  const fixedIncome = active.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const fixedExpense = active.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const debtMonthly = debts.reduce((sum, debt) => sum + (debt.monthlyPayment ?? 0), 0);
  // Debt payments not already posted through a recurring item still weigh on the month.
  const unlinkedDebt = debts.filter((debt) => !debt.recurringId || !active.some((item) => item.id === debt.recurringId)).reduce((sum, debt) => sum + (debt.monthlyPayment ?? 0), 0);
  const fixed = fixedExpense + unlinkedDebt;
  const owes = debts.reduce((sum, debt) => sum + debtLeft(debt, bundle.debtPaid), 0);
  const income = fixedIncome || loggedIncome || estimatedIncome;
  const summary: PositionSummary = {
    has: balances.cash + balances.savings, cash: balances.cash, savings: balances.savings, owes, debtMonthly,
    fixedIncome, fixedExpense: fixed, income,
    emergencyMonths: fixed > 0 ? Math.floor(Math.max(0, balances.savings) / fixed * 10) / 10 : undefined,
    debtRatio: income > 0 && debtMonthly > 0 ? debtMonthly / income : undefined,
    fixedRatio: income > 0 && fixed > 0 ? fixed / income : undefined,
    notes: [],
  };
  if (summary.debtRatio !== undefined) summary.notes.push(summary.debtRatio <= 0.35
    ? { tone: "ok", text: `Trả nợ ${short(debtMonthly)}/tháng = ${pct(summary.debtRatio)} thu nhập, dưới ngưỡng an toàn 35%.` }
    : { tone: "warn", text: `Trả nợ ${short(debtMonthly)}/tháng = ${pct(summary.debtRatio)} thu nhập, cao hơn ngưỡng an toàn 35%. Ưu tiên trả khoản lãi cao trước.` });
  if (summary.fixedRatio !== undefined && summary.fixedRatio > 0.6) summary.notes.push({ tone: "warn", text: `Chi cố định chiếm ${pct(summary.fixedRatio)} thu nhập, chỉ còn khoảng ${short(Math.max(0, income - fixed))}/tháng cho ăn uống và chi linh hoạt.` });
  if (summary.emergencyMonths !== undefined) summary.notes.push(summary.emergencyMonths >= 3
    ? { tone: "ok", text: `Tiết kiệm đủ khoảng ${summary.emergencyMonths.toLocaleString("vi-VN")} tháng chi cố định nếu tạm mất thu nhập.` }
    : { tone: "warn", text: `Tiết kiệm mới đủ khoảng ${summary.emergencyMonths.toLocaleString("vi-VN")} tháng chi cố định; nên có quỹ dự phòng 3–6 tháng.` });
  return summary;
}

type Entry = Pick<MoneyTransaction, "kind" | "amount" | "occurredOn" | "recurringId">;

/** Totals of entries dated before `before` (exclusive, YYYY-MM-DD). */
export function sumUntil(entries: Entry[], before: string) {
  const sums = { income: 0, expense: 0, saving: 0 };
  for (const entry of entries) if (entry.occurredOn < before) sums[entry.kind] += entry.amount;
  return sums;
}

/** With a saved position, balances are anchored on what the family said it had on `asOf`; debts shrink by payments since. */
export function withPosition(bundle: MoneyBundle, entries: Entry[]): MoneyBundle {
  const position = bundle.settings.position;
  if (!position) return bundle;
  const dayAfter = new Date(Date.parse(`${position.asOf}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { ...bundle, settings: { ...bundle.settings, ...anchorFromPosition(position, sumUntil(entries, dayAfter)) }, debtPaid: debtPayments(position.debts, position.asOf, entries) };
}

/** Ledger category for a debt's monthly payment, among the family's active expense categories. */
export function debtCategory(name: string, active: string[]): string {
  const norm = name.toLowerCase();
  const wanted = /thẻ|the tin dung|credit/.test(norm) ? "Tiền thẻ tín dụng" : /góp|gop|mua xe|mua nhà|mua nha|ngân hàng|ngan hang|bank/.test(norm) ? "Tiền trả góp" : "Tiền trả nợ";
  return active.includes(wanted) ? wanted : active.includes("Tiền trả nợ") ? "Tiền trả nợ" : active.includes("Khác") ? "Khác" : active[0] ?? "Khác";
}

export interface DebtSync { debts: MoneyDebt[]; upserts: MoneyRecurring[]; deletes: string[] }

/**
 * Keeps each debt's monthly payment as a recurring expense (so it posts into the ledger when due).
 * A new payment whose day already passed this month is marked as posted: the balance the family typed today
 * already reflects it. Debts removed or without a payment drop their recurring item.
 */
export function syncDebtRecurring(next: MoneyDebt[], previous: MoneyDebt[], recurring: MoneyRecurring[], active: string[], today: string, newId: () => string): DebtSync {
  const month = today.slice(0, 7); const day = Number(today.slice(8, 10));
  const upserts: MoneyRecurring[] = []; const deletes: string[] = [];
  const debts = next.map((debt) => {
    const existing = debt.recurringId ? recurring.find((item) => item.id === debt.recurringId) : undefined;
    if (!debt.monthlyPayment || !debt.dueDay) {
      if (existing) deletes.push(existing.id);
      return { ...debt, recurringId: undefined };
    }
    const item: MoneyRecurring = existing
      ? { ...existing, name: `Trả ${debt.name}`, amount: debt.monthlyPayment, dayOfMonth: debt.dueDay, category: existing.category || debtCategory(debt.name, active) }
      : { id: newId(), name: `Trả ${debt.name}`, kind: "expense", category: debtCategory(debt.name, active), amount: debt.monthlyPayment, dayOfMonth: debt.dueDay, active: true, lastPostedMonth: debt.dueDay <= day ? month : undefined };
    const changed = !existing || existing.name !== item.name || existing.amount !== item.amount || existing.dayOfMonth !== item.dayOfMonth;
    if (changed) upserts.push(item);
    return { ...debt, recurringId: item.id };
  });
  for (const gone of previous.filter((debt) => debt.recurringId && !next.some((item) => item.id === debt.id))) if (!deletes.includes(gone.recurringId!)) deletes.push(gone.recurringId!);
  return { debts, upserts, deletes };
}
