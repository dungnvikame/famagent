import { appliesInMonth, expectedAmount, isMonthly, windowIn } from "./fixed-items.ts";
import { BORROW_IN, LEND_OUT, REPAID_IN, REPAY_OUT } from "./loans.ts";
import type { MoneyCategory, MoneyRecurring, MoneySettings } from "./types.ts";

/**
 * The month plan from what the family already told the app: income from its fixed items, minus what it saves, is
 * what it can spend; fixed expenses come off that and the rest is flexible spending, split across categories by
 * how much each one usually costs. Pure arithmetic, no LLM.
 */

const active = (recurring: MoneyRecurring[]) => recurring.filter((item) => item.active);
const amountOf = (item: MoneyRecurring, amounts?: Record<string, number[]>) => expectedAmount(item, amounts).amount;

/** Income the fixed items bring in that month (salary, rent received…). */
export const plannedIncome = (recurring: MoneyRecurring[], month: string, amounts?: Record<string, number[]>) =>
  active(recurring).filter((item) => item.kind === "income" && appliesInMonth(item, month)).reduce((sum, item) => sum + amountOf(item, amounts), 0);

/** Expenses that come every month (rent, electricity, instalments): the "khoản cố định hằng tháng" of the plan. */
export const fixedMonthly = (recurring: MoneyRecurring[], amounts?: Record<string, number[]>) =>
  active(recurring).filter((item) => item.kind === "expense" && isMonthly(item)).reduce((sum, item) => sum + amountOf(item, amounts), 0);

/** Quarter/year expenses spread over the months (tuition ÷ 3, insurance ÷ 12): what is worth setting aside each month. */
export const setAsideMonthly = (recurring: MoneyRecurring[], amounts?: Record<string, number[]>) =>
  active(recurring).filter((item) => item.kind === "expense" && !isMonthly(item)).reduce((sum, item) => sum + amountOf(item, amounts) / (item.schedule?.kind === "year" ? 12 : 3), 0);

/**
 * The month's spending plan. With a monthly saving and income from fixed items it is income − saving (nothing to type);
 * otherwise the plan the family typed (or the onboarding estimate), if any.
 */
export function effectivePlan(settings: Pick<MoneySettings, "monthlyPlan" | "monthlySaving">, recurring: MoneyRecurring[], month: string, amounts?: Record<string, number[]>): number | undefined {
  const income = plannedIncome(recurring, month, amounts);
  if (settings.monthlySaving !== undefined && income > 0) return Math.max(0, income - settings.monthlySaving);
  return settings.monthlyPlan;
}

/** What is left for day-to-day spending: plan − monthly fixed expenses (never negative). */
export const flexibleBudget = (plan: number, recurring: MoneyRecurring[], amounts?: Record<string, number[]>) => Math.max(0, plan - fixedMonthly(recurring, amounts));

const LOAN_CATEGORIES = new Set([...BORROW_IN, ...REPAY_OUT, ...LEND_OUT, ...REPAID_IN]);
/** Expense categories that are day-to-day spending: not a fixed item's category, not loans/debts. */
export function flexibleCategories(categories: MoneyCategory[], recurring: MoneyRecurring[]): string[] {
  const fixed = new Set(active(recurring).filter((item) => item.kind === "expense").map((item) => item.category));
  return categories.filter((item) => item.kind === "expense" && !item.archived && !fixed.has(item.name) && !LOAN_CATEGORIES.has(item.name)).map((item) => item.name);
}

export interface BudgetLine { category: string; limit: number; /** "set" = the family typed it for this month; "auto" = shared from the flexible budget. */ source: "set" | "auto"; average: number }

/**
 * Category budgets: the ones the family set stay as typed; the flexible budget left over is shared among the other
 * flexible categories in proportion to their usual monthly spend (3-month average), in whole thousands with the
 * last line taking the rounding. Categories with no history get nothing automatic.
 */
export function budgetLines(flexTotal: number, averages: Record<string, number>, categories: string[], overrides: Record<string, number>): BudgetLine[] {
  const lines: BudgetLine[] = [];
  for (const [category, limit] of Object.entries(overrides)) lines.push({ category, limit, source: "set", average: averages[category] ?? 0 });
  const free = categories.filter((name) => !(name in overrides) && (averages[name] ?? 0) > 0);
  const room = Math.max(0, flexTotal - Object.values(overrides).reduce((a, b) => a + b, 0));
  const weight = free.reduce((sum, name) => sum + averages[name], 0);
  let given = 0;
  free.forEach((name, index) => {
    const limit = index === free.length - 1 ? room - given : Math.round(room * averages[name] / weight / 1000) * 1000;
    given += limit;
    lines.push({ category: name, limit: Math.max(0, limit), source: "auto", average: averages[name] });
  });
  return lines.sort((a, b) => b.limit - a.limit);
}

export interface CashflowMonth { month: string; income: number; fixed: number; lumps: Array<{ name: string; amount: number }>; flexible: number; saving: number; left: number }

/**
 * The next months from the fixed items and the plan: income, monthly fixed expenses, quarter/year lumps that fall in
 * the month, flexible spending (the plan's flexible part) and the monthly saving. `left` is what stays in cash if
 * lumps are paid from the month itself (the family may cover them from savings instead).
 */
export function cashflow(recurring: MoneyRecurring[], settings: Pick<MoneySettings, "monthlySaving" | "monthlyPlan">, months: string[], amounts?: Record<string, number[]>): CashflowMonth[] {
  return months.map((month) => {
    const income = plannedIncome(recurring, month, amounts);
    const fixed = fixedMonthly(recurring, amounts);
    const lumps = active(recurring).filter((item) => item.kind === "expense" && !isMonthly(item) && windowIn(item, month)).map((item) => ({ name: item.name, amount: amountOf(item, amounts) }));
    const plan = effectivePlan(settings, recurring, month, amounts);
    const flexible = plan === undefined ? 0 : flexibleBudget(plan, recurring, amounts);
    const saving = settings.monthlySaving ?? 0;
    return { month, income, fixed, lumps, flexible, saving, left: income - fixed - lumps.reduce((s, l) => s + l.amount, 0) - flexible - saving };
  });
}
