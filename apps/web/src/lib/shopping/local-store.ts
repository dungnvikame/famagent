"use client";

// Demo-mode (no Supabase) storage for Shopping, plus the shared fetch helper for the cloud API.
import type { ShoppingItem } from "./items";
import type { Purchase } from "./purchases";

const PURCHASES_KEY = "family-ai:purchases:v1";
const ITEMS_KEY = "family-ai:shopping-items:v1";
/** Demo-mode keys for the phase 2 resources (checks, plan, dismissed). */
export const LOCAL_KEYS = { checks: "family-ai:stock-checks:v1", plan: "family-ai:shopping-plan:v1", dismissed: "family-ai:shopping-dismissed:v1" } as const;

export function readLocal<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; } }
export const writeLocal = <T,>(key: string, items: T[]) => localStorage.setItem(key, JSON.stringify(items));

export const readLocalPurchases = () => readLocal<Purchase>(PURCHASES_KEY);
export const writeLocalPurchases = (items: Purchase[]) => writeLocal(PURCHASES_KEY, items);
export const readLocalItems = () => readLocal<ShoppingItem>(ITEMS_KEY);
export const writeLocalItems = (items: ShoppingItem[]) => writeLocal(ITEMS_KEY, items);
export function saveLocalItem(item: ShoppingItem) { writeLocalItems([...readLocalItems().filter((entry) => entry.id !== item.id), item]); }

export async function shoppingApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || (response.status === 401 ? "Cần đăng nhập để ghi lần mua." : "Không thể đồng bộ dữ liệu.")); }
  return response.json() as Promise<T>;
}
