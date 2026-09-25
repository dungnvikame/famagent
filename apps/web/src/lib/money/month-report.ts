import { categoryAverages, type MonthTotals } from "./history.ts";
import { daysInMonth, monthKey, type MonthSummary } from "./summary.ts";
import type { MoneyBudget, MoneyTransaction } from "./types.ts";

/**
 * Numbers behind the Tháng tab: the month's pace against the plan, up to three short insights with an action,
 * spend per category vs budget and the 3-month average, comparison with last month, and chart series.
 */

export interface Pulse { spent: number; plan?: number; expected?: number; planToDate?: number; daysLeft?: number; progress?: number; todayAt?: number; status: "over" | "ok" | "none" | "done" }
export interface InsightAction { label: string; kind: "ledger" | "budget" | "situ"; category?: string }
export interface MonthInsight { key: string; tone: "warn" | "ok" | "info"; text: string; action?: InsightAction }
export interface CategoryRow { name: string; spent: number; count: number; budget?: number; average?: number; change?: number }
export interface Delta { label: string; value: number; diff?: number; goodWhenUp: boolean }

const vnd = (amount: number) => `${Math.round(amount).toLocaleString("vi-VN")}đ`;

export function pulseOf(summary: MonthSummary, now = new Date()): Pulse {
  const current = monthKey(now) === summary.month;
  const days = daysInMonth(summary.month);
  const plan = summary.plan;
  if (!plan) return { spent: summary.expense, status: "none" };
  if (!current) return { spent: summary.expense, plan, progress: summary.expense / plan, status: summary.expense > plan ? "over" : "done" };
  const day = now.getDate();
  const expected = summary.expectedExpense ?? summary.expense;
  return { spent: summary.expense, plan, expected, planToDate: Math.round(plan * day / days), daysLeft: days - day, progress: summary.expense / plan, todayAt: day / days, status: expected > plan * 1.02 ? "over" : "ok" };
}

/** Expense categories of the month (plus budgeted ones with nothing spent), most spent first. */
export function categoryRows(transactions: MoneyTransaction[], budgets: MoneyBudget[], history: MonthTotals[] | undefined, month: string): CategoryRow[] {
  const averages = history ? categoryAverages(history, month) : {};
  const rows = new Map<string, CategoryRow>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || !tx.occurredOn.startsWith(month)) continue;
    const row = rows.get(tx.category) ?? { name: tx.category, spent: 0, count: 0 };
    row.spent += tx.amount; row.count += 1; rows.set(tx.category, row);
  }
  for (const budget of budgets) if (!rows.has(budget.category)) rows.set(budget.category, { name: budget.category, spent: 0, count: 0 });
  return [...rows.values()].map((row) => {
    const budget = budgets.find((item) => item.category === row.name)?.limitAmount;
    const average = averages[row.name];
    return { ...row, budget, average, change: average && row.spent ? Math.round((row.spent / average - 1) * 100) : undefined };
  }).sort((a, b) => b.spent - a.spent || (b.budget ?? 0) - (a.budget ?? 0));
}

/** At most three insights, most useful first: overspend, jumps vs usual, bills due soon, then what went well. */
export function monthInsights(summary: MonthSummary, rows: CategoryRow[], now = new Date(), lemAdded = 0): MonthInsight[] {
  const out: MonthInsight[] = [];
  // Spending that ran past cash this month came out of the savings fund: first, it is the one to act on.
  if (lemAdded > 0) out.push({ key: "lem", tone: "warn", text: `Tháng này tiêu lẹm tiết kiệm ${vnd(lemAdded)}`, action: { label: "Xem các khoản", kind: "ledger" } });
  for (const row of rows) if (row.budget && row.spent > row.budget) out.push({ key: `over:${row.name}`, tone: "warn", text: `${row.name} vượt ngân sách ${vnd(row.spent - row.budget)}`, action: { label: `Xem ${row.count} khoản`, kind: "ledger", category: row.name } });
  const jump = rows.filter((row) => row.average && row.change !== undefined && row.change >= 20 && row.spent - row.average >= 300_000 && !(row.budget && row.spent > row.budget)).sort((a, b) => (b.spent - b.average!) - (a.spent - a.average!))[0];
  if (jump) out.push({ key: `jump:${jump.name}`, tone: "warn", text: `${jump.name} cao hơn trung bình 3 tháng ${jump.change}%`, action: { label: `Xem ${jump.count} khoản`, kind: "ledger", category: jump.name } });
  const dueOut = summary.upcoming.filter((item) => item.kind === "expense");
  if (monthKey(now) === summary.month && dueOut.length) out.push({ key: "due", tone: "info", text: `${dueOut.length} khoản sắp đến hạn · ${vnd(dueOut.reduce((sum, item) => sum + item.amount, 0))}`, action: { label: "Xem khoản cố định", kind: "situ" } });
  if (summary.income > 0 && summary.saving > 0 && summary.saving / summary.income >= 0.1) out.push({ key: "saving", tone: "ok", text: `Để dành ${Math.round(summary.saving / summary.income * 100)}% thu nhập tháng này` });
  const calm = rows.filter((row) => row.budget && row.spent > 0 && row.spent <= row.budget * 0.9).sort((a, b) => b.spent - a.spent)[0];
  if (calm) out.push({ key: `calm:${calm.name}`, tone: "ok", text: `${calm.name} trong ngân sách (${Math.round(calm.spent / calm.budget! * 100)}%)` });
  const noBudget = rows.filter((row) => !row.budget && row.spent > 0)[0];
  if (noBudget && !summary.plan) out.push({ key: "budget", tone: "info", text: `Chưa có ngân sách cho ${noBudget.name}`, action: { label: "Đặt ngân sách", kind: "budget", category: noBudget.name } });
  return out.slice(0, 3);
}

/** This month vs the one before (from the 12-month history). */
export function versusLastMonth(history: MonthTotals[] | undefined, month: string): Delta[] | undefined {
  const index = history?.findIndex((row) => row.month === month) ?? -1;
  if (!history || index < 1) return undefined;
  const now = history[index]; const before = history[index - 1];
  if (!before.income && !before.expense && !before.saving) return undefined;
  return [{ label: "Thu", value: now.income, diff: now.income - before.income, goodWhenUp: true }, { label: "Chi", value: now.expense, diff: now.expense - before.expense, goodWhenUp: false }, { label: "Để dành", value: now.saving, diff: now.saving - before.saving, goodWhenUp: true }];
}

/** Cumulative expense per day of the month (up to `lastDay`). */
export function cumulativeSpend(transactions: MoneyTransaction[], month: string, lastDay: number): number[] {
  const perDay = new Array(lastDay).fill(0);
  for (const tx of transactions) if (tx.kind === "expense" && tx.occurredOn.startsWith(month)) { const day = Number(tx.occurredOn.slice(8, 10)); if (day <= lastDay) perDay[day - 1] += tx.amount; }
  let total = 0;
  return perDay.map((amount) => (total += amount));
}

/** Closing cash per day of the month (up to `lastDay`), from the month's opening cash. */
export function dailyCash(transactions: MoneyTransaction[], month: string, opening: number, lastDay: number): number[] {
  const perDay = new Array(lastDay).fill(0);
  for (const tx of transactions) if (tx.occurredOn.startsWith(month)) { const day = Number(tx.occurredOn.slice(8, 10)); if (day <= lastDay) perDay[day - 1] += tx.kind === "income" ? tx.amount : -tx.amount; }
  let cash = opening;
  return perDay.map((change) => (cash += change));
}

/** The largest expenses of the month. */
export const topExpenses = (transactions: MoneyTransaction[], month: string, count = 5) => transactions.filter((tx) => tx.kind === "expense" && tx.occurredOn.startsWith(month)).sort((a, b) => b.amount - a.amount).slice(0, count);
