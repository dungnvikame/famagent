"use client";

// Browser-side Money store: Supabase via /api/money when configured, otherwise localStorage (demo mode).
// Both paths return the same MoneyBundle so the UI and the Family Brief do not care where data lives.
import { cloudEnabled } from "@/lib/experience/cloud";
import { monthlyHistory } from "./history";
import { mergePeriods, periodsFromEntries, recurringAmountsFrom } from "./fixed-items";
import { debtLinkIds, isLoanEntry, personLoanTotals } from "./loans";
import { confirmLocal, undoLocal, type ConfirmInput, type PeriodRecord } from "./period-confirm";
import { sumUntil, withPosition } from "./position";
import { currentCategories, currentCategory, DEFAULT_CATEGORIES, type MoneyBudget, type MoneyBundle, type MoneyRange, type MoneyGoal, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types";

export type { ConfirmInput } from "./period-confirm";

const KEY = "family-ai:money:v1";
interface LocalMoney { settings: MoneySettings; transactions: MoneyTransaction[]; budgets: MoneyBudget[]; recurring: MoneyRecurring[]; goals: MoneyGoal[]; /** Answers to fixed-item periods (older saves have none). */ periods: PeriodRecord[] }
const empty = (): LocalMoney => ({ settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES }, transactions: [], budgets: [], recurring: [], goals: [], periods: [] });
function readLocal(): LocalMoney {
  try {
    const data: LocalMoney = { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) || "null") ?? {}) };
    // Current category names on read (entries saved under a short-lived v2 name read under the familiar one).
    return { ...data, settings: { ...data.settings, categories: currentCategories(data.settings.categories ?? DEFAULT_CATEGORIES) }, transactions: data.transactions.map((item) => ({ ...item, category: currentCategory(item.category, item.kind) })), budgets: data.budgets.map((item) => ({ ...item, category: currentCategory(item.category, "expense") })), recurring: data.recurring.map((item) => ({ ...item, category: currentCategory(item.category, item.kind) })) };
  } catch { return empty(); }
}
function writeLocal(data: LocalMoney) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function clearLocalMoney() { localStorage.removeItem(KEY); }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || (response.status === 401 ? "Cần đăng nhập để dùng sổ thu chi." : "Không thể đồng bộ dữ liệu.")); }
  return response.json() as Promise<T>;
}

export async function loadMoney(month: string): Promise<MoneyBundle> {
  if (cloudEnabled) return (await api<{ bundle: MoneyBundle }>(`/api/money?month=${month}`)).bundle;
  const data = readLocal();
  // "YYYY-MM-99" sorts after every day of the month, so it works as an exclusive upper bound for string dates.
  const debtLinks = debtLinkIds(data.settings.position?.debts ?? []);
  return withPosition({ history: monthlyHistory(data.transactions, month, 12), loans: personLoanTotals(data.transactions, debtLinks), month, settings: { ...empty().settings, ...data.settings }, transactions: data.transactions.filter((item) => item.occurredOn.startsWith(month)).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)), totals: sumUntil(data.transactions, `${month}-99`), budgets: data.budgets.filter((item) => item.month === month), recurring: data.recurring, goals: data.goals, periods: mergePeriods(data.periods.map((record) => ({ recurringId: record.recurringId, period: record.period, status: record.status, paidOn: record.paidOn, amount: record.amount })), periodsFromEntries(data.transactions)), recurringAmounts: recurringAmountsFrom(data.transactions) }, data.transactions);
}

/** Sổ filter over any date range: entries from..to (newest first) and the cash balance just before `from`. */
export async function loadRange(from: string, to: string): Promise<MoneyRange> {
  if (cloudEnabled) return (await api<{ range: MoneyRange }>(`/api/money/range?from=${from}&to=${to}`)).range;
  const data = readLocal();
  const settings = withPosition({ month: from.slice(0, 7), settings: { ...empty().settings, ...data.settings }, transactions: [], totals: { income: 0, expense: 0, saving: 0 }, budgets: [], recurring: [], goals: [] }, data.transactions).settings;
  const before = sumUntil(data.transactions, from);
  const transactions = data.transactions.filter((item) => item.occurredOn >= from && item.occurredOn <= to).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  return { from, to, transactions, openingCash: settings.openingCash + before.income - (before.expense - before.fromSavings) - before.saving, openingSavings: settings.openingSavings + before.saving - before.fromSavings };
}

/** Every borrowing / lending entry, newest first (Nợ tab). */
export async function loadLoans(): Promise<MoneyTransaction[]> {
  if (cloudEnabled) return (await api<{ loans: MoneyTransaction[] }>("/api/money/loans")).loans;
  return readLocal().transactions.filter((tx) => isLoanEntry(tx)).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

type Resource = "transactions" | "budgets" | "recurring" | "goals";
type ItemOf<R extends Resource> = R extends "transactions" ? MoneyTransaction : R extends "budgets" ? MoneyBudget : R extends "recurring" ? MoneyRecurring : MoneyGoal;

export async function saveMoneyItem<R extends Resource>(resource: R, item: ItemOf<R>): Promise<void> {
  if (cloudEnabled) { await api(`/api/money/${resource}`, { method: "PUT", body: JSON.stringify({ item }) }); return; }
  const data = readLocal();
  const list = data[resource] as ItemOf<R>[];
  // Budgets are unique per (category, month) like the DB constraint.
  const index = list.findIndex((existing) => existing.id === item.id || (resource === "budgets" && (existing as MoneyBudget).category === (item as MoneyBudget).category && (existing as MoneyBudget).month === (item as MoneyBudget).month));
  if (index >= 0) list[index] = item; else list.push(item);
  writeLocal(data);
}

export async function deleteMoneyItem(resource: Resource, id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/money/${resource}?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  const data = readLocal();
  (data[resource] as Array<{ id: string }>) = (data[resource] as Array<{ id: string }>).filter((item) => item.id !== id) as never;
  // A deleted fixed item takes its answers with it (the server cascades).
  if (resource === "recurring") data.periods = data.periods.filter((period) => period.recurringId !== id);
  writeLocal(data);
}

export async function saveMoneySettings(settings: MoneySettings): Promise<void> {
  if (cloudEnabled) { await api("/api/money", { method: "PUT", body: JSON.stringify({ settings }) }); return; }
  const data = readLocal(); data.settings = settings; writeLocal(data);
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Answers one period of a fixed item: "paid" writes the ledger entry (with the real date/amount), "skipped" only records the answer. */
export async function confirmPeriod(input: ConfirmInput): Promise<{ transaction?: MoneyTransaction }> {
  if (cloudEnabled) { const { transaction } = await api<{ transaction?: MoneyTransaction }>("/api/money/periods", { method: "POST", body: JSON.stringify(input) }); return { transaction }; }
  const data = readLocal();
  const result = confirmLocal(data, input, today(), crypto.randomUUID());
  writeLocal(data);
  return result;
}

/** Takes an answer back and removes the ledger entry it created. */
export async function undoPeriod(recurringId: string, period: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/money/periods?recurringId=${encodeURIComponent(recurringId)}&period=${encodeURIComponent(period)}`, { method: "DELETE" }); return; }
  const data = readLocal(); undoLocal(data, recurringId, period); writeLocal(data);
}
