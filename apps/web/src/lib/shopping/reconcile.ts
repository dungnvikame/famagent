// Ledger ↔ Shopping (phase 2): expenses the family typed into Tiền under Con / Mua sắm that no purchase explains yet.
// Asking "khoản này là mua gì?" turns them into purchases without a second ledger row.
import type { MoneyTransaction } from "../money/types.ts";
import type { ShoppingItem } from "./items.ts";
import { matchItem, purchasesOf } from "./items.ts";
import type { Purchase } from "./purchases.ts";

/** Ledger categories that household shopping lands in (transactionForPurchase writes these). */
export const SHOPPING_CATEGORIES = ["Con", "Mua sắm"];

/** A typed expense within this many days of a purchase of the same amount is that purchase entered twice. */
export const MATCH_WINDOW_DAYS = 2;
const dayNumber = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

export function unlinkedTransactions(transactions: MoneyTransaction[], purchases: Purchase[], dismissed: string[]): MoneyTransaction[] {
  const linked = new Set(purchases.map((purchase) => purchase.transactionId).filter(Boolean));
  const skip = new Set(dismissed);
  const open = transactions.filter((tx) => tx.kind === "expense" && tx.source === "manual" && SHOPPING_CATEGORIES.includes(tx.category) && tx.amount > 0 && !linked.has(tx.id) && !skip.has(tx.id))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  // A purchase that recorded its own expense already explains a same-amount, same-week row typed by hand.
  // Each purchase explains one row, so two real identical purchases still ask about the second one.
  const spare = purchases.filter((purchase) => purchase.source !== "ledger");
  const pairs = open.flatMap((tx, row) => spare.map((purchase, index) => ({ row, index, gap: Math.abs(dayNumber(purchase.purchasedOn) - dayNumber(tx.occurredOn)), same: purchase.amount === tx.amount })))
    .filter((pair) => pair.same && pair.gap <= MATCH_WINDOW_DAYS)
    .sort((a, b) => a.gap - b.gap || a.row - b.row);
  const explained = new Set<number>(); const used = new Set<number>();
  for (const { row, index } of pairs) if (!explained.has(row) && !used.has(index)) { explained.add(row); used.add(index); }
  return open.filter((_, row) => !explained.has(row));
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
