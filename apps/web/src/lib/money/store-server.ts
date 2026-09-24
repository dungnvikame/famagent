// Supabase persistence for the Money module (tables in migration 202609240007). Row ↔ type mapping lives here
// so API routes stay thin; the same shapes are used by the local (browser-only) store.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dueRecurring, postingFor } from "./summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBudget, type MoneyBundle, type MoneyGoal, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : undefined;
const num = (value: unknown) => typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

export const transactionFromRow = (row: Row): MoneyTransaction => ({ id: row.id as string, occurredOn: row.occurred_on as string, content: row.content as string, category: row.category as string, kind: row.kind as MoneyTransaction["kind"], amount: num(row.amount), forChild: row.for_child === true, childId: str(row.child_id), note: str(row.note), source: row.source as MoneyTransaction["source"], recurringId: str(row.recurring_id) });
export const transactionRow = (item: MoneyTransaction, userId: string) => ({ id: item.id, user_id: userId, occurred_on: item.occurredOn, content: item.content, category: item.category, kind: item.kind, amount: item.amount, for_child: item.forChild, child_id: item.childId ?? null, note: item.note ?? null, source: item.source, recurring_id: item.recurringId ?? null, updated_at: new Date().toISOString() });
const budgetFromRow = (row: Row): MoneyBudget => ({ id: row.id as string, category: row.category as string, month: (row.month as string).slice(0, 7), limitAmount: num(row.limit_amount) });
export const budgetRow = (item: MoneyBudget, userId: string) => ({ id: item.id, user_id: userId, category: item.category, month: `${item.month}-01`, limit_amount: item.limitAmount });
const recurringFromRow = (row: Row): MoneyRecurring => ({ id: row.id as string, name: row.name as string, category: row.category as string, kind: row.kind as MoneyRecurring["kind"], amount: num(row.amount), dayOfMonth: num(row.day_of_month), active: row.active !== false, lastPostedMonth: str(row.last_posted_month)?.slice(0, 7) });
export const recurringRow = (item: MoneyRecurring, userId: string) => ({ id: item.id, user_id: userId, name: item.name, category: item.category, kind: item.kind, amount: item.amount, day_of_month: item.dayOfMonth, active: item.active, last_posted_month: item.lastPostedMonth ? `${item.lastPostedMonth}-01` : null });
const goalFromRow = (row: Row): MoneyGoal => ({ id: row.id as string, name: row.name as string, targetAmount: num(row.target_amount), savedAmount: num(row.saved_amount), monthlyPlan: row.monthly_plan === null || row.monthly_plan === undefined ? undefined : num(row.monthly_plan) });
export const goalRow = (item: MoneyGoal, userId: string) => ({ id: item.id, user_id: userId, name: item.name, target_amount: item.targetAmount, saved_amount: item.savedAmount, monthly_plan: item.monthlyPlan ?? null });
const settingsFromRow = (row: Row | null): MoneySettings => row ? { openingCash: num(row.opening_cash), openingSavings: num(row.opening_savings), monthlyPlan: row.monthly_plan === null || row.monthly_plan === undefined ? undefined : num(row.monthly_plan), categories: Array.isArray(row.categories) && row.categories.length ? row.categories as MoneySettings["categories"] : DEFAULT_CATEGORIES } : { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES };
export const settingsRow = (item: MoneySettings, userId: string) => ({ user_id: userId, opening_cash: item.openingCash, opening_savings: item.openingSavings, monthly_plan: item.monthlyPlan ?? null, categories: item.categories, updated_at: new Date().toISOString() });

export const TABLES = { transactions: "money_transactions", budgets: "money_budgets", recurring: "money_recurring", goals: "money_goals" } as const;
export type MoneyResource = keyof typeof TABLES;

/** Month bundle; posts due recurring items first so opening the page is enough to keep the ledger current. */
export async function loadBundle(client: SupabaseClient, userId: string, month: string, now = new Date()): Promise<MoneyBundle | null> {
  const { data: recurringRows, error: recurringError } = await client.from(TABLES.recurring).select("*").eq("user_id", userId).order("day_of_month");
  if (recurringError) return null;
  let recurring = (recurringRows ?? []).map(recurringFromRow);
  const due = dueRecurring(recurring, month, now);
  if (due.length) {
    const { error: postError } = await client.from(TABLES.transactions).insert(due.map((item) => transactionRow(postingFor(item, month, crypto.randomUUID()), userId)));
    if (!postError) {
      await client.from(TABLES.recurring).upsert(due.map((item) => recurringRow({ ...item, lastPostedMonth: month }, userId)));
      recurring = recurring.map((item) => due.some((posted) => posted.id === item.id) ? { ...item, lastPostedMonth: month } : item);
    }
  }
  const monthEnd = `${month}-31`;
  const [settings, transactions, totals, budgets, goals] = await Promise.all([
    client.from("money_settings").select("*").eq("user_id", userId).maybeSingle(),
    client.from(TABLES.transactions).select("*").eq("user_id", userId).gte("occurred_on", `${month}-01`).lte("occurred_on", monthEnd).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
    client.from(TABLES.transactions).select("kind,amount").eq("user_id", userId).lte("occurred_on", monthEnd).limit(20000),
    client.from(TABLES.budgets).select("*").eq("user_id", userId).eq("month", `${month}-01`),
    client.from(TABLES.goals).select("*").eq("user_id", userId).order("created_at"),
  ]);
  if (settings.error || transactions.error || totals.error || budgets.error || goals.error) return null;
  const sums = { income: 0, expense: 0, saving: 0 };
  for (const row of totals.data ?? []) sums[row.kind as keyof typeof sums] += num(row.amount);
  return { month, settings: settingsFromRow(settings.data), transactions: (transactions.data ?? []).map(transactionFromRow), totals: sums, budgets: (budgets.data ?? []).map(budgetFromRow), recurring, goals: (goals.data ?? []).map(goalFromRow) };
}
