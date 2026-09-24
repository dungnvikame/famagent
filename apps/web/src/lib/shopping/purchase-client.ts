"use client";

// Browser side of purchases: /api/purchases when Supabase is configured, else localStorage (demo mode)
// where the same PURCHASE_COMPLETED processing writes the ledger entry into the local money store.
import { cloudEnabled } from "@/lib/experience/cloud";
import { deleteMoneyItem, saveMoneyItem } from "@/lib/money/client";
import { transactionForPurchase, type Purchase } from "./purchases";

const KEY = "family-ai:purchases:v1";
function readLocal(): Purchase[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Purchase[]; } catch { return []; } }
const writeLocal = (items: Purchase[]) => localStorage.setItem(KEY, JSON.stringify(items));

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || (response.status === 401 ? "Cần đăng nhập để ghi lần mua." : "Không thể đồng bộ dữ liệu.")); }
  return response.json() as Promise<T>;
}

export async function loadPurchases(): Promise<Purchase[]> {
  if (cloudEnabled) return (await api<{ purchases: Purchase[] }>("/api/purchases")).purchases;
  return readLocal().sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
}

export async function recordPurchase(purchase: Purchase, forChild: boolean): Promise<Purchase> {
  if (cloudEnabled) return (await api<{ purchase: Purchase }>("/api/purchases", { method: "POST", body: JSON.stringify({ purchase, forChild }) })).purchase;
  const transaction = transactionForPurchase(purchase, forChild, crypto.randomUUID());
  await saveMoneyItem("transactions", transaction);
  const stored = { ...purchase, transactionId: transaction.id };
  writeLocal([...readLocal(), stored]);
  return stored;
}

export async function setPurchaseRate(id: string, dailyRate: number | null): Promise<void> {
  if (cloudEnabled) { await api("/api/purchases", { method: "PATCH", body: JSON.stringify({ id, dailyRate }) }); return; }
  writeLocal(readLocal().map((item) => item.id === id ? { ...item, dailyRate: dailyRate ?? undefined } : item));
}

export async function deletePurchase(id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/purchases?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  const item = readLocal().find((entry) => entry.id === id);
  if (item?.transactionId) await deleteMoneyItem("transactions", item.transactionId);
  writeLocal(readLocal().filter((entry) => entry.id !== id));
}
