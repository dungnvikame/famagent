import type { MoneyBundle, MoneyRecurring, MoneyTransaction } from "./types.ts";
import { dueEntries, fixedStillDue, type DueEntry } from "./fixed-items.ts";
import { categoryAverages } from "./history.ts";
import { budgetLines, effectivePlan, flexibleBudget, flexibleCategories, type BudgetLine } from "./plan.ts";
import { debtLinkIds, loanFlows, loanRole, type LoanTotals } from "./loans.ts";
import { vnd } from "../catalog/format.ts";

/**
 * Month analytics for the Money home and the Family Brief (SPEC_V2 §10–11): rules + arithmetic, no LLM.
 * Pure so every rule is unit-tested; the Coordinator's money answers are templated from this too.
 */
export interface CategoryLine { category: string; spent: number; limit?: number; ratio?: number; forChild: number }
export interface UpcomingItem { id: string; name: string; amount: number; kind: MoneyRecurring["kind"]; dueOn: string; daysLeft: number }
export interface MoneyInsight { id: string; tone: "warn" | "ok" | "info"; text: string; source: string }

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  saving: number;
  /** income − expense − saving for the month. */
  net: number;
  /** Cash change over the month (for the month's opening balance). */
  cashChange: number;
  /** Savings fund change over the month (transfers in − withdrawals − expenses paid from the fund). */
  savingsChange: number;
  /** Planned spend (settings.monthlyPlan) or the sum of category budgets, if any. */
  plan?: number;
  remainingOfPlan?: number;
  /** Month-end forecast (current month only): spent so far + fixed items still to post + the flexible pace for the days left. */
  expectedExpense?: number;
  paceRatio?: number;
  /** Loan money inside income / expense (borrowed, collected / repaid, lent): already counted above, shown as "trong đó". */
  loanFlows: LoanTotals;
  childSpend: number;
  byCategory: CategoryLine[];
  upcoming: UpcomingItem[];
  /** Fixed-item periods waiting for an answer (current month only): asking now, coming up, or overdue. */
  due: DueEntry[];
  /** Fixed expenses of the month nobody has confirmed yet, at their expected amount: held back from "còn tiêu được". */
  fixedDue: number;
  /** plan − spent − fixedDue: what can still be spent freely this month (current month only). */
  freeToSpend?: number;
  /** Category budgets in force: the ones the family set, plus the shared ones from the flexible budget. */
  budgetPlan: BudgetLine[];
  balances: { cash: number; savings: number };
  insights: MoneyInsight[];
  transactionCount: number;
}

export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
export const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const daysInMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const shortVnd = (amount: number) => { const abs = Math.abs(amount); const sign = amount < 0 ? "−" : ""; if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`; if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}K`; return `${sign}${abs}đ`; };

export function sumByKind(transactions: MoneyTransaction[]) {
  const totals = { income: 0, expense: 0, saving: 0 };
  for (const item of transactions) totals[item.kind] += item.amount;
  return totals;
}

/** Fixed-item periods asking within a week, in the shape the Brief and the month view already read. */
export function upcomingFrom(due: DueEntry[]): UpcomingItem[] {
  return due.filter((entry) => entry.state !== "overdue" && entry.daysToStart <= 7).map((entry) => ({ id: entry.recurringId, name: entry.name, amount: entry.amount, kind: entry.kind, dueOn: entry.from, daysLeft: Math.max(0, entry.daysToStart) }));
}

/**
 * Month-end spend: what is already spent, plus the fixed expenses that have not posted yet (they come once, at
 * their amount), plus the flexible spend's daily pace for the days left. Flexible = expenses that are not from a
 * recurring item; one-off loan and debt payments are left out of the pace too (a lump is not a daily habit) but
 * stay in what was spent. So rent posted on the 1st is never multiplied by the days of the month.
 */
function forecastExpense(spent: number, inMonth: MoneyTransaction[], fixedDue: number, elapsed: number, days: number): number {
  const flexible = inMonth.filter((item) => item.kind === "expense" && !item.recurringId && !item.debtId && !loanRole(item)).reduce((sum, item) => sum + item.amount, 0);
  return Math.round(spent + fixedDue + flexible / elapsed * (days - elapsed));
}

export function summarizeMonth(bundle: MoneyBundle, now = new Date()): MonthSummary {
  const { month, transactions, budgets, settings, recurring, totals } = bundle;
  const periods = bundle.periods ?? []; const amounts = bundle.recurringAmounts;
  // Loans (borrowing, repaying, lending, being paid back) are ordinary Thu/Chi; loanFlows tells how much of it they are.
  const inMonth = transactions.filter((item) => item.occurredOn.startsWith(month));
  const sums = sumByKind(inMonth);
  const byMap = new Map<string, CategoryLine>();
  for (const item of inMonth) {
    if (item.kind !== "expense") continue;
    const line = byMap.get(item.category) ?? { category: item.category, spent: 0, forChild: 0 };
    line.spent += item.amount; if (item.forChild) line.forChild += item.amount;
    byMap.set(item.category, line);
  }
  // Budgets the family set for this month stay as typed. Once it plans by saving (monthlySaving) and there is history,
  // the flexible budget is shared among the other categories by what each usually costs.
  const overrides: Record<string, number> = {};
  for (const budget of budgets) if (budget.month === month) overrides[budget.category] = budget.limitAmount;
  const familyPlan = effectivePlan(settings, recurring, month, amounts);
  const shared: BudgetLine[] = settings.monthlySaving !== undefined && familyPlan !== undefined && bundle.history?.length
    ? budgetLines(flexibleBudget(familyPlan, recurring, amounts), categoryAverages(bundle.history, month), flexibleCategories(settings.categories, recurring), overrides)
    : Object.entries(overrides).map(([category, limit]) => ({ category, limit, source: "set" as const, average: 0 }));
  for (const budget of shared) { const line = byMap.get(budget.category) ?? { category: budget.category, spent: 0, forChild: 0 }; line.limit = budget.limit; byMap.set(budget.category, line); }
  const byCategory = [...byMap.values()].map((line) => ({ ...line, ratio: line.limit ? line.spent / line.limit : undefined })).sort((a, b) => b.spent - a.spent);
  const budgetTotal = byCategory.reduce((acc, line) => acc + (line.limit ?? 0), 0);
  const plan = familyPlan ?? (budgetTotal || undefined);

  const current = monthKey(now) === month;
  const days = daysInMonth(month);
  const elapsed = current ? Math.max(1, now.getDate()) : days;
  const due = current ? dueEntries(recurring, periods, amounts, now) : [];
  const fixedDue = current ? fixedStillDue(recurring, periods, amounts, month) : 0;
  const expectedExpense = current && sums.expense > 0 ? forecastExpense(sums.expense, inMonth, fixedDue, elapsed, days) : undefined;
  const paceRatio = plan && expectedExpense ? expectedExpense / plan : undefined;
  const childSpend = inMonth.filter((item) => item.kind === "expense" && item.forChild).reduce((acc, item) => acc + item.amount, 0);
  const upcoming = upcomingFrom(due);
  const fromSavings = totals.fromSavings ?? 0;
  const balances = { cash: settings.openingCash + totals.income - (totals.expense - fromSavings) - totals.saving, savings: settings.openingSavings + totals.saving - fromSavings };
  const monthFromSavings = inMonth.filter((item) => item.kind === "expense" && item.paidFrom === "savings").reduce((sum, item) => sum + item.amount, 0);

  const insights: MoneyInsight[] = [];
  if (plan && paceRatio !== undefined && paceRatio > 1.05) {
    const top = byCategory.filter((line) => line.limit && line.spent > line.limit).slice(0, 2).map((line) => `${line.category} (+${vnd(line.spent - line.limit!)})`);
    insights.push({ id: "over-pace", tone: "warn", text: `Với nhịp chi hiện tại, tháng này sẽ chi khoảng ${vnd(expectedExpense!)} — cao hơn kế hoạch ${vnd(plan)} khoảng ${Math.round((paceRatio - 1) * 100)}%${top.length ? `. Vượt ngân sách: ${top.join(", ")}` : ""}.`, source: `Từ ${inMonth.length} giao dịch tháng này và kế hoạch bạn đặt` });
  } else if (plan && paceRatio !== undefined && paceRatio <= 0.9 && elapsed >= 10) {
    insights.push({ id: "under-pace", tone: "ok", text: `Đang chi chậm hơn kế hoạch (~${Math.round(paceRatio * 100)}%). Nếu giữ nhịp này, cuối tháng còn dư khoảng ${vnd(plan - expectedExpense!)}.`, source: "Từ nhịp chi tháng này so với kế hoạch" });
  }
  for (const line of byCategory) if (line.limit && line.spent > line.limit && !insights.some((item) => item.id === "over-pace")) { insights.push({ id: `over-${line.category}`, tone: "warn", text: `${line.category} đã vượt ngân sách ${vnd(line.limit)} (đã chi ${vnd(line.spent)}).`, source: "Từ ngân sách theo nhóm" }); break; }
  if (childSpend > 0 && sums.expense > 0 && childSpend / sums.expense >= 0.25) insights.push({ id: "child-share", tone: "info", text: `Chi cho con chiếm ${Math.round(childSpend / sums.expense * 100)}% chi tiêu tháng này (${vnd(childSpend)}).`, source: "Từ các khoản đánh dấu “cho con”" });
  if (sums.income > 0 && sums.saving > 0) insights.push({ id: "saving-rate", tone: "ok", text: `Đã chuyển ${vnd(sums.saving)} vào tiết kiệm — ${Math.round(sums.saving / sums.income * 100)}% thu nhập tháng này.`, source: "Từ các khoản tiết kiệm" });

  return { month, ...sums, net: sums.income - sums.expense - sums.saving, cashChange: sums.income - (sums.expense - monthFromSavings) - sums.saving, savingsChange: sums.saving - monthFromSavings, plan, remainingOfPlan: plan !== undefined ? plan - sums.expense : undefined, expectedExpense, paceRatio, loanFlows: loanFlows(inMonth, debtLinkIds(settings.position?.debts ?? [])), childSpend, byCategory, upcoming, due, fixedDue, freeToSpend: current && plan !== undefined ? plan - sums.expense - fixedDue : undefined, budgetPlan: shared, balances, insights: insights.slice(0, 3), transactionCount: inMonth.length };
}

/**
 * A monthly recurring item made from an entry the family just typed ("Hằng tháng"): the entry itself is this
 * month's posting, so the item counts that month as posted and repeats from the next one.
 */
export function recurringFor(entry: Pick<MoneyTransaction, "content" | "kind" | "category" | "amount" | "occurredOn">, dayOfMonth: number, id: string): MoneyRecurring {
  return { id, name: entry.content, kind: entry.kind, category: entry.category, amount: Math.abs(entry.amount), dayOfMonth, active: true, lastPostedMonth: entry.occurredOn.slice(0, 7) };
}
