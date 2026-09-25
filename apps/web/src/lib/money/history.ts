import type { MoneyKind, MoneyTransaction } from "./types.ts";

/** One month of totals for trend charts and "vs. earlier months" comparisons. */
export interface MonthTotals { month: string; income: number; expense: number; saving: number; byCategory: Record<string, number> }

type Entry = Pick<MoneyTransaction, "kind" | "amount" | "occurredOn" | "category">;

const shift = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/** The `count` months ending with `endMonth` (oldest first), with income / expense / saving and expense per category. */
export function monthlyHistory(entries: Entry[], endMonth: string, count = 12): MonthTotals[] {
  const months = Array.from({ length: count }, (_, i) => shift(endMonth, i - count + 1));
  const byMonth = new Map(months.map((month) => [month, { month, income: 0, expense: 0, saving: 0, byCategory: {} as Record<string, number> }]));
  for (const entry of entries) {
    const row = byMonth.get(entry.occurredOn.slice(0, 7));
    if (!row) continue;
    row[entry.kind as MoneyKind] += entry.amount;
    if (entry.kind === "expense") row.byCategory[entry.category] = (row.byCategory[entry.category] ?? 0) + entry.amount;
  }
  return months.map((month) => byMonth.get(month)!);
}

/** Average expense per category over the months before `month` that have any spending (up to `span` months). */
export function categoryAverages(history: MonthTotals[], month: string, span = 3): Record<string, number> {
  const earlier = history.filter((row) => row.month < month && row.expense > 0).slice(-span);
  if (!earlier.length) return {};
  const sums: Record<string, number> = {};
  for (const row of earlier) for (const [name, amount] of Object.entries(row.byCategory)) sums[name] = (sums[name] ?? 0) + amount;
  return Object.fromEntries(Object.entries(sums).map(([name, total]) => [name, Math.round(total / earlier.length)]));
}

/** Cash after each entry, oldest first from `opening` (entries may arrive newest first; ties keep their order). */
export function runningBalances(entries: Array<Pick<MoneyTransaction, "id" | "kind" | "amount" | "occurredOn">>, opening: number): Map<string, number> {
  const ordered = entries.map((entry, index) => ({ entry, index })).sort((a, b) => a.entry.occurredOn.localeCompare(b.entry.occurredOn) || b.index - a.index);
  const out = new Map<string, number>();
  let cash = opening;
  for (const { entry } of ordered) { cash += entry.kind === "income" ? entry.amount : -entry.amount; out.set(entry.id, cash); }
  return out;
}

/** After each entry: the savings fund, what was spent beyond cash ("tiêu lẹm", owed to the fund) and the account total. */
export interface PotBalance { savings: number; lem: number; account: number; cash: number }

/**
 * Running pots, oldest first. Cash = opening + income − expense − saving transfers; the savings fund = opening +
 * saving transfers (withdrawals are negative). When cash drops below zero, that part was spent out of the fund:
 * tiêu lẹm = max(0, −cash). The account holds both: account = savings + cash (= savings − tiêu lẹm when cash < 0).
 */
export function runningPots(entries: Array<Pick<MoneyTransaction, "id" | "kind" | "amount" | "occurredOn">>, openingCash: number, openingSavings: number): Map<string, PotBalance> {
  const ordered = entries.map((entry, index) => ({ entry, index })).sort((a, b) => a.entry.occurredOn.localeCompare(b.entry.occurredOn) || b.index - a.index);
  const out = new Map<string, PotBalance>();
  let cash = openingCash; let savings = openingSavings;
  for (const { entry } of ordered) {
    if (entry.kind === "income") cash += entry.amount;
    else if (entry.kind === "expense") cash -= entry.amount;
    else { cash -= entry.amount; savings += entry.amount; }
    out.set(entry.id, { savings, lem: Math.max(0, -cash), account: savings + cash, cash });
  }
  return out;
}

/** The pots at one point in time from the two balances. */
export const potsOf = (cash: number, savings: number): PotBalance => ({ savings, lem: Math.max(0, -cash), account: savings + cash, cash });
