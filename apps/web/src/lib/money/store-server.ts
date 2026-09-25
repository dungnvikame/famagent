// Supabase persistence for the Money module (tables in migration 202609240007). Row ↔ type mapping lives here
// so API routes stay thin; the same shapes are used by the local (browser-only) store.
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyHistory } from "./history.ts";
import { BORROW_IN, isLoanEntry, LEND_OUT, loanTotals, REPAID_IN, REPAY_OUT } from "./loans.ts";
import { sumUntil, withPosition } from "./position.ts";
import { dueRecurring, postingFor } from "./summary.ts";
import { currentCategories, currentCategory, DEFAULT_CATEGORIES, type MoneyBudget, type MoneyBundle, type MoneyRange, type MoneyGoal, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : undefined;
const num = (value: unknown) => typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

export const transactionFromRow = (row: Row): MoneyTransaction => ({ id: row.id as string, occurredOn: row.occurred_on as string, content: row.content as string, category: currentCategory(row.category as string, row.kind as MoneyTransaction["kind"]), kind: row.kind as MoneyTransaction["kind"], amount: num(row.amount), forChild: row.for_child === true, childId: str(row.child_id), note: str(row.note), source: row.source as MoneyTransaction["source"], recurringId: str(row.recurring_id), paidFrom: row.paid_from === "savings" ? "savings" : undefined });
export const transactionRow = (item: MoneyTransaction, userId: string) => ({ id: item.id, user_id: userId, occurred_on: item.occurredOn, content: item.content, category: item.category, kind: item.kind, amount: item.amount, for_child: item.forChild, child_id: item.childId ?? null, note: item.note ?? null, source: item.source, recurring_id: item.recurringId ?? null, paid_from: item.paidFrom === "savings" && item.kind === "expense" ? "savings" : "cash", updated_at: new Date().toISOString() });
const budgetFromRow = (row: Row): MoneyBudget => ({ id: row.id as string, category: currentCategory(row.category as string, "expense"), month: (row.month as string).slice(0, 7), limitAmount: num(row.limit_amount) });
export const budgetRow = (item: MoneyBudget, userId: string) => ({ id: item.id, user_id: userId, category: item.category, month: `${item.month}-01`, limit_amount: item.limitAmount });
const recurringFromRow = (row: Row): MoneyRecurring => ({ id: row.id as string, name: row.name as string, category: currentCategory(row.category as string, row.kind as MoneyRecurring["kind"]), kind: row.kind as MoneyRecurring["kind"], amount: num(row.amount), dayOfMonth: num(row.day_of_month), active: row.active !== false, lastPostedMonth: str(row.last_posted_month)?.slice(0, 7) });
export const recurringRow = (item: MoneyRecurring, userId: string) => ({ id: item.id, user_id: userId, name: item.name, category: item.category, kind: item.kind, amount: item.amount, day_of_month: item.dayOfMonth, active: item.active, last_posted_month: item.lastPostedMonth ? `${item.lastPostedMonth}-01` : null });
const goalFromRow = (row: Row): MoneyGoal => ({ id: row.id as string, name: row.name as string, targetAmount: num(row.target_amount), savedAmount: num(row.saved_amount), monthlyPlan: row.monthly_plan === null || row.monthly_plan === undefined ? undefined : num(row.monthly_plan) });
export const goalRow = (item: MoneyGoal, userId: string) => ({ id: item.id, user_id: userId, name: item.name, target_amount: item.targetAmount, saved_amount: item.savedAmount, monthly_plan: item.monthlyPlan ?? null });
export const settingsFromRow = (row: Row | null): MoneySettings => row ? { openingCash: num(row.opening_cash), openingSavings: num(row.opening_savings), monthlyPlan: row.monthly_plan === null || row.monthly_plan === undefined ? undefined : num(row.monthly_plan), categories: currentCategories(Array.isArray(row.categories) ? row.categories as MoneySettings["categories"] : DEFAULT_CATEGORIES), position: (row.position ?? undefined) as MoneySettings["position"], allocation: currentAllocation(row.allocation as MoneySettings["allocation"]), categoryMemory: (row.category_memory ?? undefined) as MoneySettings["categoryMemory"] } : { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES };
/** Allocation parts hold expense and saving names; both renames apply (income names never appear there). */
const currentAllocation = (allocation?: MoneySettings["allocation"] | null): MoneySettings["allocation"] => allocation ? { ...allocation, buckets: allocation.buckets.map((bucket) => ({ ...bucket, categories: [...new Set(bucket.categories.map((name) => currentCategory(currentCategory(name, "expense"), "saving")))] })) } : undefined;
export const settingsRow = (item: MoneySettings, userId: string) => ({ user_id: userId, opening_cash: item.openingCash, opening_savings: item.openingSavings, monthly_plan: item.monthlyPlan ?? null, categories: item.categories, position: item.position ?? null, allocation: item.allocation ?? null, category_memory: item.categoryMemory ?? {}, updated_at: new Date().toISOString() });

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
  // First day of the next month: "YYYY-MM-31" is not a valid date for 30-day months and fails in Postgres.
  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = `${monthIndex === 12 ? year + 1 : year}-${String(monthIndex === 12 ? 1 : monthIndex + 1).padStart(2, "0")}-01`;
  const [settings, transactions, totals, budgets, goals] = await Promise.all([
    client.from("money_settings").select("*").eq("user_id", userId).maybeSingle(),
    client.from(TABLES.transactions).select("*").eq("user_id", userId).gte("occurred_on", `${month}-01`).lt("occurred_on", nextMonth).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
    // Every entry's amount and date: running totals to this month, plus the position anchor and debt payments.
    allEntries(client, userId),
    client.from(TABLES.budgets).select("*").eq("user_id", userId).eq("month", `${month}-01`),
    client.from(TABLES.goals).select("*").eq("user_id", userId).order("created_at"),
  ]);
  if (settings.error || transactions.error || totals.error || budgets.error || goals.error) return null;
  const all = entriesFromRows(totals.data ?? []);
  const loadedSettings = settingsFromRow(settings.data);
  const debtRecurring = new Set((loadedSettings.position?.debts ?? []).map((debt) => debt.recurringId).filter((id): id is string => Boolean(id)));
  return withPosition({ history: monthlyHistory(all, month, 12), loans: loanTotals(all, debtRecurring), month, settings: settingsFromRow(settings.data), transactions: (transactions.data ?? []).map(transactionFromRow), totals: sumUntil(all, nextMonth), budgets: (budgets.data ?? []).map(budgetFromRow), recurring, goals: (goals.data ?? []).map(goalFromRow) }, all);
}


const PAGE = 1000; // PostgREST returns at most this many rows per request by default

/** Every ledger entry's kind/amount/date, read page by page (a single select would stop at the row cap). */
async function allEntries(client: SupabaseClient, userId: string): Promise<{ data: Row[] | null; error: unknown }> {
  const rows: Row[] = [];
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await client.from(TABLES.transactions).select("kind,amount,occurred_on,recurring_id,category,paid_from").eq("user_id", userId).order("id").range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}

const entriesFromRows = (rows: Row[]) => rows.map((row) => ({ kind: row.kind as MoneyTransaction["kind"], amount: num(row.amount), occurredOn: String(row.occurred_on), recurringId: str(row.recurring_id), category: currentCategory(String(row.category ?? ""), row.kind as MoneyTransaction["kind"]), paidFrom: row.paid_from === "savings" ? "savings" as const : undefined }));

/** Entries dated from..to (inclusive, newest first) and the cash balance just before `from` (position anchor applied). */
export async function loadRange(client: SupabaseClient, userId: string, from: string, to: string): Promise<MoneyRange | null> {
  const [settings, transactions, entries] = await Promise.all([
    client.from("money_settings").select("*").eq("user_id", userId).maybeSingle(),
    client.from(TABLES.transactions).select("*").eq("user_id", userId).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(3000),
    allEntries(client, userId),
  ]);
  if (settings.error || transactions.error || entries.error) return null;
  const all = entriesFromRows(entries.data ?? []);
  // Opening balances as of the position anchor (same rule as the month bundle), then everything before `from`.
  const anchored = withPosition({ month: from.slice(0, 7), settings: settingsFromRow(settings.data), transactions: [], totals: { income: 0, expense: 0, saving: 0 }, budgets: [], recurring: [], goals: [] }, all).settings;
  const before = sumUntil(all, from);
  return { from, to, transactions: (transactions.data ?? []).map(transactionFromRow), openingCash: anchored.openingCash + before.income - (before.expense - before.fromSavings) - before.saving, openingSavings: anchored.openingSavings + before.saving - before.fromSavings };
}

/** Every borrowing / lending entry (all months, newest first) for the Nợ tab. */
export async function loadLoans(client: SupabaseClient, userId: string): Promise<MoneyTransaction[] | null> {
  // Current and short-lived v2 names, so older entries are found too (currentCategory renames them on read).
  const names = [...BORROW_IN, ...REPAY_OUT, ...LEND_OUT, ...REPAID_IN, "Tiền trả nợ cá nhân", "Tiền trả nợ"];
  const { data, error } = await client.from(TABLES.transactions).select("*").eq("user_id", userId).in("category", [...new Set(names)]).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5000);
  if (error) return null;
  return (data ?? []).map(transactionFromRow).filter((tx) => isLoanEntry(tx));
}
