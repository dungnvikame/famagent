import { scheduleOf, windowLabel, type DueEntry } from "./fixed-items.ts";
import { fixedMonthly, flexibleBudget, plannedIncome, setAsideMonthly } from "./plan.ts";
import { doneWord } from "./recurring-form.ts";
import { daysInMonth, type MonthSummary } from "./summary.ts";
import type { MoneyBudget, MoneyBundle, MoneyRecurring, RecurringPeriod } from "./types.ts";
import { vndCompact } from "./format-vnd.ts";

/** What the Kế hoạch tab shows, as plain numbers and labels (pure, so the rules are unit-tested). */

export const SAVING_STEP = 500_000;
const SAVING_SHARE = 0.2;

/** 20% of income rounded to 500k: where a family with no saving set yet starts. */
export const suggestedSaving = (income: number) => Math.min(Math.max(0, income), Math.round(income * SAVING_SHARE / SAVING_STEP) * SAVING_STEP);

/** One stepper click: to the next multiple of 500k in that direction, kept between 0 and the planned income. */
export function stepSaving(current: number, direction: 1 | -1, income: number): number {
  const next = direction > 0 ? (Math.floor(current / SAVING_STEP) + 1) * SAVING_STEP : (Math.ceil(current / SAVING_STEP) - 1) * SAVING_STEP;
  return Math.min(Math.max(0, income), Math.max(0, next));
}

export interface PlanFigures {
  income: number;
  /** Name of the first active income item that counts this month ("↻ Lương"). */
  incomeFrom?: string;
  fixed: number;
  saving: number;
  /** false = `saving` is the 20% suggestion, nothing stored yet. */
  savingStored: boolean;
  savingPct: number;
  /** Quarter/year expenses spread per month. */
  setAside: number;
  /** income − fixed − saving; below 0 the plan does not add up. */
  flexRaw: number;
  flex: number;
  perDay: number;
  /** The month's spending plan = income − saving (= fixed + flexible; the "kế hoạch chi" behind "Còn tiêu được"). */
  plan: number;
  /** Stacked bar shares in percent (fixed, flexible, saving); all 0 when there is nothing to show. */
  bar: { fixed: number; flex: number; saving: number };
}

export function planFigures(bundle: Pick<MoneyBundle, "recurring" | "settings" | "recurringAmounts">, month: string): PlanFigures {
  const { recurring, settings, recurringAmounts: amounts } = bundle;
  const income = plannedIncome(recurring, month, amounts);
  const fixed = fixedMonthly(recurring, amounts);
  const savingStored = settings.monthlySaving !== undefined;
  const saving = settings.monthlySaving ?? suggestedSaving(income);
  const flex = flexibleBudget(Math.max(0, income - saving), recurring, amounts);
  const total = fixed + flex + saving;
  const share = (value: number) => total > 0 ? value / total * 100 : 0;
  const first = recurring.find((item) => item.active && item.kind === "income" && plannedIncome([item], month, amounts) > 0);
  return {
    income, incomeFrom: first?.name, fixed, saving, savingStored, savingPct: income > 0 ? Math.round(saving / income * 100) : 0,
    setAside: setAsideMonthly(recurring, amounts), flexRaw: income - fixed - saving, flex, perDay: Math.round(flex / daysInMonth(month) / 1000) * 1000,
    plan: Math.max(0, income - saving), bar: { fixed: share(fixed), flex: share(flex), saving: share(saving) },
  };
}

// ---------- fixed items list ----------

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Hằng tháng · ngày 26", "Theo quý · 1–10 của T1/4/7/10": the schedule as the family reads it (day 31 stays 31). */
export function scheduleText(item: Pick<MoneyRecurring, "schedule" | "dayOfMonth">): string {
  const schedule = scheduleOf(item);
  const label = (month: string) => windowLabel(item, month);
  switch (schedule.kind) {
    case "month": case "range": return `Hằng tháng · ${label("2026-01")}`;
    case "eom": return "Hằng tháng · cuối tháng";
    case "quarter": return `Theo quý · ${label("2026-01")} của T1/4/7/10`;
    case "year": return `Hằng năm · tháng ${schedule.month} · ${label(`2026-${String(schedule.month).padStart(2, "0")}`)}`;
  }
}

export interface ItemStatus { tone: "paid" | "due" | "overdue" | "soon" | "skipped" | "later" | "paused"; label: string }

/** Where a fixed item stands in `month`: answered (paid/skipped/marked done), asking now, coming, or not yet. */
export function itemStatus(item: MoneyRecurring, month: string, periods: RecurringPeriod[], due: DueEntry[], today: string): ItemStatus {
  if (!item.active) return { tone: "paused", label: "Tạm dừng" };
  const answer = periods.find((period) => period.recurringId === item.id && period.period === month);
  if (answer?.status === "skipped") return { tone: "skipped", label: "Bỏ qua kỳ này" };
  if (answer) return { tone: "paid", label: `${doneWord(item.kind)}${answer.paidOn ? ` ${dayMonth(answer.paidOn)}` : ""}${answer.amount ? ` · ${vndCompact(answer.amount)}` : ""}` };
  const waiting = due.find((entry) => entry.recurringId === item.id && entry.period === month);
  if (waiting) return waiting.state === "overdue" ? { tone: "overdue", label: "Quá hạn" } : waiting.state === "due" ? { tone: "due", label: "Tới hạn" } : { tone: "soon", label: "Sắp tới" };
  if (item.lastPostedMonth && month <= item.lastPostedMonth) return { tone: "paid", label: item.kind === "expense" ? "Đã xong" : doneWord(item.kind) };
  return { tone: "later", label: month < today.slice(0, 7) ? "Chưa ghi nhận" : "Chưa tới" };
}

/** Income first, then savings, then expenses; running items before paused ones; earlier days first. */
export function listedItems(recurring: MoneyRecurring[]): MoneyRecurring[] {
  const rank = (item: MoneyRecurring) => (item.active ? 0 : 3) + (item.kind === "income" ? 0 : item.kind === "saving" ? 1 : 2);
  return [...recurring].sort((a, b) => rank(a) - rank(b) || a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name, "vi"));
}

// ---------- category budgets ----------

export interface BudgetRow { category: string; limit: number; spent: number; source: "set" | "auto"; average: number; /** The budget row to overwrite when the family edits this limit. */ budgetId?: string }

export function budgetRows(summary: Pick<MonthSummary, "budgetPlan" | "byCategory">, budgets: MoneyBudget[], month: string): BudgetRow[] {
  return summary.budgetPlan.map((line) => ({
    category: line.category, limit: line.limit, source: line.source, average: line.average,
    spent: summary.byCategory.find((item) => item.category === line.category)?.spent ?? 0,
    budgetId: budgets.find((item) => item.month === month && item.category === line.category)?.id,
  }));
}

/** Sum of the category limits against the flexible budget: `free` > 0 = not yet shared out, < 0 = shared out too much. */
export const budgetBalance = (rows: BudgetRow[], flexible: number) => { const total = rows.reduce((sum, row) => sum + row.limit, 0); return { total, free: flexible - total }; };
