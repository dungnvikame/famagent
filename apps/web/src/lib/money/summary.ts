import type { MoneyBundle, MoneyRecurring, MoneyTransaction } from "./types.ts";

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
  /** Planned spend (settings.monthlyPlan) or the sum of category budgets, if any. */
  plan?: number;
  remainingOfPlan?: number;
  /** Linear pace: spent / daysElapsed × daysInMonth (only for the current month). */
  expectedExpense?: number;
  paceRatio?: number;
  childSpend: number;
  byCategory: CategoryLine[];
  upcoming: UpcomingItem[];
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

/** Recurring items due in the next `horizonDays` from `now` (this month or next), regardless of posting state. */
export function upcomingRecurring(recurring: MoneyRecurring[], now: Date, horizonDays = 7): UpcomingItem[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: UpcomingItem[] = [];
  for (const item of recurring) {
    if (!item.active) continue;
    for (const offset of [0, 1]) {
      const y = today.getFullYear(); const m = today.getMonth() + offset;
      const due = new Date(y, m, Math.min(item.dayOfMonth, new Date(y, m + 1, 0).getDate()));
      const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      if (daysLeft >= 0 && daysLeft <= horizonDays) { out.push({ id: item.id, name: item.name, amount: item.amount, kind: item.kind, dueOn: localDate(due), daysLeft }); break; }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function summarizeMonth(bundle: MoneyBundle, now = new Date()): MonthSummary {
  const { month, transactions, budgets, settings, recurring, totals } = bundle;
  const inMonth = transactions.filter((item) => item.occurredOn.startsWith(month));
  const sums = sumByKind(inMonth);
  const byMap = new Map<string, CategoryLine>();
  for (const item of inMonth) {
    if (item.kind !== "expense") continue;
    const line = byMap.get(item.category) ?? { category: item.category, spent: 0, forChild: 0 };
    line.spent += item.amount; if (item.forChild) line.forChild += item.amount;
    byMap.set(item.category, line);
  }
  for (const budget of budgets) if (budget.month === month) { const line = byMap.get(budget.category) ?? { category: budget.category, spent: 0, forChild: 0 }; line.limit = budget.limitAmount; byMap.set(budget.category, line); }
  const byCategory = [...byMap.values()].map((line) => ({ ...line, ratio: line.limit ? line.spent / line.limit : undefined })).sort((a, b) => b.spent - a.spent);
  const budgetTotal = byCategory.reduce((acc, line) => acc + (line.limit ?? 0), 0);
  const plan = settings.monthlyPlan ?? (budgetTotal || undefined);

  const current = monthKey(now) === month;
  const days = daysInMonth(month);
  const elapsed = current ? Math.max(1, now.getDate()) : days;
  const expectedExpense = current && sums.expense > 0 ? Math.round(sums.expense / elapsed * days) : undefined;
  const paceRatio = plan && expectedExpense ? expectedExpense / plan : undefined;
  const childSpend = inMonth.filter((item) => item.kind === "expense" && item.forChild).reduce((acc, item) => acc + item.amount, 0);
  const upcoming = current ? upcomingRecurring(recurring, now) : [];
  const balances = { cash: settings.openingCash + totals.income - totals.expense - totals.saving, savings: settings.openingSavings + totals.saving };

  const insights: MoneyInsight[] = [];
  if (plan && paceRatio !== undefined && paceRatio > 1.05) {
    const top = byCategory.filter((line) => line.limit && line.spent > line.limit).slice(0, 2).map((line) => `${line.category} (+${shortVnd(line.spent - line.limit!)})`);
    insights.push({ id: "over-pace", tone: "warn", text: `Với nhịp chi hiện tại, tháng này sẽ chi khoảng ${shortVnd(expectedExpense!)} — cao hơn kế hoạch ${shortVnd(plan)} khoảng ${Math.round((paceRatio - 1) * 100)}%${top.length ? `. Vượt ngân sách: ${top.join(", ")}` : ""}.`, source: `Từ ${inMonth.length} giao dịch tháng này và kế hoạch bạn đặt` });
  } else if (plan && paceRatio !== undefined && paceRatio <= 0.9 && elapsed >= 10) {
    insights.push({ id: "under-pace", tone: "ok", text: `Đang chi chậm hơn kế hoạch (~${Math.round(paceRatio * 100)}%). Nếu giữ nhịp này, cuối tháng còn dư khoảng ${shortVnd(plan - expectedExpense!)}.`, source: "Từ nhịp chi tháng này so với kế hoạch" });
  }
  for (const line of byCategory) if (line.limit && line.spent > line.limit && !insights.some((item) => item.id === "over-pace")) { insights.push({ id: `over-${line.category}`, tone: "warn", text: `${line.category} đã vượt ngân sách ${shortVnd(line.limit)} (đã chi ${shortVnd(line.spent)}).`, source: "Từ ngân sách theo nhóm" }); break; }
  if (childSpend > 0 && sums.expense > 0 && childSpend / sums.expense >= 0.25) insights.push({ id: "child-share", tone: "info", text: `Chi cho con chiếm ${Math.round(childSpend / sums.expense * 100)}% chi tiêu tháng này (${shortVnd(childSpend)}).`, source: "Từ các khoản đánh dấu “cho con”" });
  if (sums.income > 0 && sums.saving > 0) insights.push({ id: "saving-rate", tone: "ok", text: `Đã chuyển ${shortVnd(sums.saving)} vào tiết kiệm — ${Math.round(sums.saving / sums.income * 100)}% thu nhập tháng này.`, source: "Từ các khoản tiết kiệm" });

  return { month, ...sums, net: sums.income - sums.expense - sums.saving, plan, remainingOfPlan: plan !== undefined ? plan - sums.expense : undefined, expectedExpense, paceRatio, childSpend, byCategory, upcoming, balances, insights: insights.slice(0, 3), transactionCount: inMonth.length };
}

/** Recurring items that should be posted into `month` (due day already reached) and have not been yet. */
export function dueRecurring(recurring: MoneyRecurring[], month: string, now: Date): MoneyRecurring[] {
  const current = monthKey(now) === month;
  return recurring.filter((item) => item.active && item.lastPostedMonth !== month && (!current || item.dayOfMonth <= now.getDate()) && month <= monthKey(now));
}

/** Transaction created when a recurring item posts. */
export function postingFor(item: MoneyRecurring, month: string, id: string): MoneyTransaction {
  const day = Math.min(item.dayOfMonth, daysInMonth(month));
  return { id, occurredOn: `${month}-${String(day).padStart(2, "0")}`, content: item.name, category: item.category, kind: item.kind, amount: item.amount, forChild: false, source: "recurring", recurringId: item.id };
}
