// Ledger ↔ Shopping (phase 2): expenses the family typed into Tiền under Con / Mua sắm that no purchase explains yet.
// Asking "khoản này là mua gì?" turns them into purchases without a second ledger row.
import type { MoneyTransaction } from "../money/types.ts";
import type { ShoppingItem } from "./items.ts";
import { matchItem, purchasesOf } from "./items.ts";
import type { Purchase } from "./purchases.ts";

/** Ledger categories that household shopping lands in (transactionForPurchase writes these). */
export const SHOPPING_CATEGORIES = ["Con", "Mua sắm"];

export function unlinkedTransactions(transactions: MoneyTransaction[], purchases: Purchase[], dismissed: string[]): MoneyTransaction[] {
  const linked = new Set(purchases.map((purchase) => purchase.transactionId).filter(Boolean));
  const skip = new Set(dismissed);
  return transactions.filter((tx) => tx.kind === "expense" && tx.source === "manual" && SHOPPING_CATEGORIES.includes(tx.category) && tx.amount > 0 && !linked.has(tx.id) && !skip.has(tx.id))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

/** Packs an expense most likely bought: the amount over the last price per pack of the item (1 when unknown). */
export function packsFor(amount: number, item: ShoppingItem, purchases: Purchase[]): number {
  const last = purchasesOf(item, purchases).filter((purchase) => purchase.source !== "ledger").at(-1);
  if (!last) return 1;
  const perPack = last.amount / Math.max(1, last.packs);
  return perPack > 0 ? Math.min(50, Math.max(1, Math.round(amount / perPack))) : 1;
}

/** Items to offer as one-tap answers: a name match first, then the most bought. */
export function suggestItems(tx: Pick<MoneyTransaction, "content" | "note">, items: ShoppingItem[], purchases: Purchase[], limit = 3): ShoppingItem[] {
  const active = items.filter((item) => item.status === "active");
  const match = matchItem(`${tx.content} ${tx.note ?? ""}`, active);
  const rest = active.filter((item) => item.id !== match?.id).sort((a, b) => purchasesOf(b, purchases).length - purchasesOf(a, purchases).length);
  return [...(match ? [match] : []), ...rest].slice(0, limit);
}
