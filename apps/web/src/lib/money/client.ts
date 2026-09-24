"use client";

// Browser-side Money store: Supabase via /api/money when configured, otherwise localStorage (demo mode).
// Both paths return the same MoneyBundle so the UI and the Family Brief do not care where data lives.
import { cloudEnabled } from "@/lib/experience/cloud";
import { dueRecurring, postingFor, sumByKind } from "./summary";
import { DEFAULT_CATEGORIES, type MoneyBudget, type MoneyBundle, type MoneyGoal, type MoneyRecurring, type MoneySettings, type MoneyTransaction } from "./types";

const KEY = "family-ai:money:v1";
interface LocalMoney { settings: MoneySettings; transactions: MoneyTransaction[]; budgets: MoneyBudget[]; recurring: MoneyRecurring[]; goals: MoneyGoal[] }
const empty = (): LocalMoney => ({ settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES }, transactions: [], budgets: [], recurring: [], goals: [] });
function readLocal(): LocalMoney { try { return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) || "null") ?? {}) }; } catch { return empty(); } }
function writeLocal(data: LocalMoney) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function clearLocalMoney() { localStorage.removeItem(KEY); }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || (response.status === 401 ? "Cần đăng nhập để dùng sổ thu chi." : "Không thể đồng bộ dữ liệu.")); }
  return response.json() as Promise<T>;
}

export async function loadMoney(month: string, now = new Date()): Promise<MoneyBundle> {
  if (cloudEnabled) return (await api<{ bundle: MoneyBundle }>(`/api/money?month=${month}`)).bundle;
  const data = readLocal();
  const due = dueRecurring(data.recurring, month, now);
  if (due.length) {
    data.transactions.push(...due.map((item) => postingFor(item, month, crypto.randomUUID())));
    data.recurring = data.recurring.map((item) => due.some((posted) => posted.id === item.id) ? { ...item, lastPostedMonth: month } : item);
    writeLocal(data);
  }
  const monthEnd = `${month}-31`;
  return { month, settings: data.settings, transactions: data.transactions.filter((item) => item.occurredOn.startsWith(month)).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)), totals: sumByKind(data.transactions.filter((item) => item.occurredOn <= monthEnd)), budgets: data.budgets.filter((item) => item.month === month), recurring: data.recurring, goals: data.goals };
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
  writeLocal(data);
}

export async function saveMoneySettings(settings: MoneySettings): Promise<void> {
  if (cloudEnabled) { await api("/api/money", { method: "PUT", body: JSON.stringify({ settings }) }); return; }
  const data = readLocal(); data.settings = settings; writeLocal(data);
}
