"use client";

// Browser side of household items: /api/shopping when Supabase is configured, else localStorage (demo mode).
import { cloudEnabled } from "@/lib/experience/cloud";
import type { ShoppingItem } from "./items";
import { readLocalItems, readLocalPurchases, saveLocalItem, shoppingApi, writeLocalItems, writeLocalPurchases } from "./local-store";
import type { ShoppingState } from "./state";

/** Demo-mode purchases recorded before items existed get one item per catalog product (same as migration 0012). */
function upgradeLocal(): void {
  const purchases = readLocalPurchases();
  if (!purchases.some((purchase) => !purchase.itemId)) return;
  const items = readLocalItems();
  const byProduct = new Map(items.filter((item) => item.productId).map((item) => [item.productId!, item]));
  for (const purchase of [...purchases].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn))) {
    if (purchase.itemId || !purchase.productId || byProduct.has(purchase.productId)) continue;
    const item: ShoppingItem = { id: crypto.randomUUID(), name: purchase.productName, category: "diapers", unit: "miếng", packSize: Math.max(1, Math.round(purchase.unitCount / Math.max(1, purchase.packs))), brand: purchase.brand, merchant: purchase.merchant, dailyRate: purchases.find((entry) => entry.productId === purchase.productId && entry.dailyRate)?.dailyRate, childId: purchase.childId, productId: purchase.productId, status: "active" };
    items.push(item); byProduct.set(purchase.productId, item);
  }
  writeLocalItems(items);
  writeLocalPurchases(purchases.map((purchase) => purchase.itemId || !purchase.productId ? purchase : { ...purchase, itemId: byProduct.get(purchase.productId)?.id }));
}

export async function loadShopping(): Promise<ShoppingState> {
  if (cloudEnabled) return shoppingApi<ShoppingState>("/api/shopping");
  upgradeLocal();
  return { items: readLocalItems(), purchases: readLocalPurchases().sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn)) };
}

export async function saveItem(item: ShoppingItem): Promise<void> {
  if (cloudEnabled) { await shoppingApi("/api/shopping/items", { method: "PUT", body: JSON.stringify({ item }) }); return; }
  saveLocalItem(item);
}

export async function deleteItem(id: string): Promise<void> {
  if (cloudEnabled) { await shoppingApi(`/api/shopping/items?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  writeLocalItems(readLocalItems().filter((item) => item.id !== id));
  writeLocalPurchases(readLocalPurchases().filter((purchase) => purchase.itemId !== id));
}
