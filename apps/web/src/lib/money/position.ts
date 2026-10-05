import { debtOverview } from "./loans.ts";
import { todayLocal } from "./parse.ts";
import type { DebtPayment, MoneyBundle, MoneyDebt, MoneyPosition, MoneyRecurring, MoneyTransaction } from "./types.ts";

/**
 * Current financial position ("Tình hình"): what the family has and owes on `asOf`, then the ledger moves it.
 * Balances stay `opening + all-time totals`; the position only decides the opening anchor, so every other
 * screen (summary, agent answers) keeps working unchanged.
 */

type Totals = { income: number; expense: number; saving: number; fromSavings?: number };

export const accountTotals = (position: MoneyPosition) => ({
  cash: position.accounts.filter((item) => item.type !== "saving").reduce((sum, item) => sum + item.amount, 0),
  savings: position.accounts.filter((item) => item.type === "saving").reduce((sum, item) => sum + item.amount, 0),
});

/** Opening balances such that `opening + totals before asOf` equals what the family had at the start of `asOf` (cash-like accounts = tiền tiêu, "Tiết kiệm" accounts = the savings fund). */
export function anchorFromPosition(position: MoneyPosition, untilAsOf: Totals): { openingCash: number; openingSavings: number } {
  const { cash, savings } = accountTotals(position);
  const fromSavings = untilAsOf.fromSavings ?? 0;
  return { openingCash: cash - (untilAsOf.income - (untilAsOf.expense - fromSavings) - untilAsOf.saving), openingSavings: savings - (untilAsOf.saving - fromSavings) };
}

type PaidEntry = Pick<MoneyTransaction, "recurringId" | "occurredOn" | "amount" | "kind" | "debtId">;

/**
 * Payments toward each debt (by debt id), dated, oldest first: expenses tagged with the debt (`debtId`) or posted
 * by its linked recurring item (each entry counts once). A hand-tagged payment counts whatever its date — tagging
 * it is the family saying "this reduces that debt". A recurring-posted one only counts after the debt's own date,
 * because earlier periods are already inside the balance the family typed.
 */
export function debtPaymentLog(debts: MoneyDebt[], asOf: string, transactions: PaidEntry[]): Record<string, DebtPayment[]> {
  const byRecurring = new Map(debts.filter((debt) => debt.recurringId).map((debt) => [debt.recurringId!, debt.id]));
  const since = new Map(debts.map((debt) => [debt.id, debt.asOf ?? asOf]));
  const log: Record<string, DebtPayment[]> = {};
  for (const tx of transactions) {
    if (tx.kind !== "expense") continue;
    const tagged = tx.debtId && since.has(tx.debtId) ? tx.debtId : undefined;
    const viaItem = !tagged && tx.recurringId ? byRecurring.get(tx.recurringId) : undefined;
    const debtId = tagged ?? (viaItem && tx.occurredOn > since.get(viaItem)! ? viaItem : undefined);
    if (debtId) (log[debtId] ??= []).push({ on: tx.occurredOn, amount: tx.amount });
  }
  for (const list of Object.values(log)) list.sort((a, b) => a.on.localeCompare(b.on));
  return log;
}

/** Total paid toward each debt since its date (by debt id); see `debtPaymentLog`. */
export function debtPayments(debts: MoneyDebt[], asOf: string, transactions: PaidEntry[]): Record<string, number> {
  return Object.fromEntries(Object.entries(debtPaymentLog(debts, asOf, transactions)).map(([id, list]) => [id, list.reduce((sum, item) => sum + item.amount, 0)]));
}

/**
 * The one interest model behind `debtLeft` and `monthsToPayOff` (so the two numbers agree). With a yearly rate,
 * interest of rate ÷ 12 accrues on the balance at the end of every full month since the debt's date, and that
 * month's payments come off after it (plain amortisation: balance × (1 + r) − payment). Payments after the last
 * full month just reduce the balance. Assumptions: monthly compounding, no fees, no early-repayment penalty, and
 * the rate is the family's own figure. Without a rate everything is interest-free.
 */
const monthlyRate = (ratePct?: number) => ratePct && ratePct > 0 ? ratePct / 100 / 12 : 0;
const afterMonth = (balance: number, rate: number, payment = 0) => Math.max(0, balance * (1 + rate) - payment);
const MAX_MONTHS = 1200; // 100 years: beyond this a debt is treated as never paid off

const addMonths = (iso: string, count: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const index = m - 1 + count; const year = y + Math.floor(index / 12); const month = ((index % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, new Date(year, month + 1, 0).getDate())).padStart(2, "0")}`;
};
/** Full months from `since` to `today` (day of month clamped, so 31/01 → 28/02 is one month). */
function fullMonths(since: string, today: string): number {
  const [sy, sm] = since.split("-").map(Number); const [ty, tm] = today.split("-").map(Number);
  let months = (ty - sy) * 12 + (tm - sm);
  if (months > 0 && addMonths(since, months) > today) months -= 1;
  return Math.min(Math.max(0, months), MAX_MONTHS);
}

/** What is still owed: the balance on the debt's date, plus interest when it has a rate, minus its payments. */
export function debtLeft(debt: MoneyDebt, paid: Record<string, number> = {}, options: { asOf?: string; today?: string; log?: Record<string, DebtPayment[]> } = {}): number {
  const total = paid[debt.id] ?? 0;
  const rate = monthlyRate(debt.ratePct); const since = debt.asOf ?? options.asOf;
  if (!rate || !since) return Math.max(0, debt.balance - total);
  const today = options.today ?? todayLocal();
  // Without dated payments (callers holding only totals) assume they were made today, after the interest accrued.
  const payments = [...(options.log?.[debt.id] ?? (total > 0 ? [{ on: today, amount: total }] : []))].sort((a, b) => a.on.localeCompare(b.on));
  let balance = debt.balance; let next = 0;
  // Hand-tagged payments dated on/before the debt's date come straight off the balance, before any interest.
  for (; next < payments.length && payments[next].on <= since; next++) balance = Math.max(0, balance - payments[next].amount);
  for (let month = 1, months = fullMonths(since, today); month <= months; month++) {
    balance = afterMonth(balance, rate);
    for (const end = addMonths(since, month); next < payments.length && payments[next].on <= end; next++) balance = Math.max(0, balance - payments[next].amount);
  }
  for (; next < payments.length; next++) balance = Math.max(0, balance - payments[next].amount);
  return Math.round(balance);
}

type DebtBook = Pick<MoneyBundle, "settings" | "debtPaid" | "debtLog" | "loans">;
/** `debtLeft` for a debt of this bundle (position date, dated payments and the rate all come from it). */
export const debtLeftIn = (bundle: DebtBook, debt: MoneyDebt, today?: string) => debtLeft(debt, bundle.debtPaid, { asOf: bundle.settings.position?.asOf, log: bundle.debtLog, today });

/**
 * The one definition of what the family owes and is owed: ledger loans net out, Tình hình debts count what is left
 * of them (`debtLeftIn`). Tình hình, the Nợ tab, the Money header and the agent all read this.
 */
export const debtTotals = (bundle: DebtBook, today?: string) => debtOverview(bundle.loans ?? { borrowed: 0, repaid: 0, lent: 0, collected: 0 }, bundle.settings.position?.debts ?? [], (debt) => debtLeftIn(bundle, debt, today));

/** Months until a debt is paid off paying `monthly` each month (same model as `debtLeft`); undefined = never. */
export function monthsToPayOff(left: number, monthly?: number, ratePct?: number): number | undefined {
  if (!monthly || monthly <= 0 || left <= 0) return left <= 0 ? 0 : undefined;
  const rate = monthlyRate(ratePct);
  if (!rate) return Math.ceil(left / monthly);
  if (monthly <= left * rate) return undefined; // payment never covers the interest
  let balance = left;
  for (let months = 1; months <= MAX_MONTHS; months++) { balance = afterMonth(balance, rate, monthly); if (balance <= 0) return months; }
  return undefined;
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
export function positionSummary(bundle: DebtBook & Pick<MoneyBundle, "recurring">, balances: { cash: number; savings: number }, loggedIncome = 0, estimatedIncome = 0, today?: string): PositionSummary {
  const position = bundle.settings.position;
  const debts = position?.debts ?? [];
  const active = bundle.recurring.filter((item: MoneyRecurring) => item.active);
  const fixedIncome = active.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const fixedExpense = active.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const debtMonthly = debts.reduce((sum, debt) => sum + (debt.monthlyPayment ?? 0), 0);
  // Debt payments not already posted through a recurring item still weigh on the month.
  const unlinkedDebt = debts.filter((debt) => !debt.recurringId || !active.some((item) => item.id === debt.recurringId)).reduce((sum, debt) => sum + (debt.monthlyPayment ?? 0), 0);
  const fixed = fixedExpense + unlinkedDebt;
  const owes = debtTotals(bundle, today).owed;
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

type Entry = Pick<MoneyTransaction, "kind" | "amount" | "occurredOn" | "recurringId" | "paidFrom" | "debtId">;

/** Totals of entries dated before `before` (exclusive, YYYY-MM-DD); fromSavings = expenses paid out of the fund. */
export function sumUntil(entries: Entry[], before: string) {
  const sums = { income: 0, expense: 0, saving: 0, fromSavings: 0 };
  for (const entry of entries) if (entry.occurredOn < before) { sums[entry.kind] += entry.amount; if (entry.kind === "expense" && entry.paidFrom === "savings") sums.fromSavings += entry.amount; }
  return sums;
}

/** With a saved position, balances are anchored on what the family said it had on `asOf`; debts shrink by payments since. */
export function withPosition(bundle: MoneyBundle, entries: Entry[]): MoneyBundle {
  const position = bundle.settings.position;
  if (!position) return bundle;
  // The typed balances are what the family had at the start of asOf, before any entry dated asOf or later.
  return { ...bundle, settings: { ...bundle.settings, ...anchorFromPosition(position, sumUntil(entries, position.asOf)) }, debtPaid: debtPayments(position.debts, position.asOf, entries), debtLog: debtPaymentLog(position.debts, position.asOf, entries) };
}

/** Ledger category for a debt's monthly payment, among the family's active expense categories. */
export function debtCategory(name: string, active: string[]): string {
  const norm = name.toLowerCase();
  const wanted = /thẻ|the tin dung|credit/.test(norm) ? "Tiền thẻ tín dụng" : /góp|gop|mua xe|mua nhà|mua nha|ngân hàng|ngan hang|bank/.test(norm) ? "Tiền trả góp" : /quỹ|hụi|hui/.test(norm) ? "Tiền trả nợ quỹ" : "Tiền trả nợ";
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
