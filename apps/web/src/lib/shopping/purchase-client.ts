"use client";

// Browser side of purchases: /api/purchases when Supabase is configured, else localStorage (demo mode)
// where the same PURCHASE_COMPLETED processing writes the ledger entry into the local money store.
import { cloudEnabled } from "@/lib/experience/cloud";
import { deleteMoneyItem, saveMoneyItem } from "@/lib/money/client";
import { addPurchaseOnce, transactionForPurchase, type Purchase } from "./purchases";
import type { ShoppingItem } from "./items";
import { readLocalPurchases, saveLocalItem, shoppingApi, writeLocalPurchases } from "./local-store";

export async function loadPurchases(): Promise<Purchase[]> {
  if (cloudEnabled) return (await shoppingApi<{ purchases: Purchase[] }>("/api/purchases")).purchases;
  return readLocalPurchases().sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
}

/**
 * PURCHASE_COMPLETED from the browser. `item` is the (new or updated) household item the purchase restocks;
 * `linkTransactionId` attaches an expense already typed in the ledger instead of creating a second one.
 */
export async function recordPurchase(purchase: Purchase, forChild: boolean, item?: ShoppingItem, linkTransactionId?: string): Promise<Purchase> {
  const withItem = { ...purchase, itemId: item?.id ?? purchase.itemId };
  if (cloudEnabled) return (await shoppingApi<{ purchase: Purchase }>("/api/purchases", { method: "POST", body: JSON.stringify({ purchase: withItem, item, forChild, linkTransactionId }) })).purchase;
  // Same purchase id = a retry of a save that already went through: return it, write nothing twice.
  const already = readLocalPurchases().find((entry) => entry.id === purchase.id || (linkTransactionId !== undefined && entry.transactionId === linkTransactionId));
  if (already) return already;
  if (item) saveLocalItem(item);
  let transactionId = linkTransactionId;
  let createdExpense = false;
  if (!transactionId) { const transaction = transactionForPurchase(withItem, forChild, crypto.randomUUID()); await saveMoneyItem("transactions", transaction); transactionId = transaction.id; createdExpense = true; }
  const stored = { ...withItem, transactionId, source: linkTransactionId ? "ledger" as const : withItem.source === "ledger" ? "quick" as const : withItem.source };
  try { writeLocalPurchases(addPurchaseOnce(readLocalPurchases(), stored).list); }
  catch (cause) { if (createdExpense) await deleteMoneyItem("transactions", transactionId); throw cause; }
  return stored;
}

export async function deletePurchase(id: string): Promise<void> {
  if (cloudEnabled) { await shoppingApi(`/api/purchases?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  const item = readLocalPurchases().find((entry) => entry.id === id);
  if (item?.transactionId && item.source !== "ledger") await deleteMoneyItem("transactions", item.transactionId);
  writeLocalPurchases(readLocalPurchases().filter((entry) => entry.id !== id));
}
