// Shopping behaviour (phase 3): what the family spends per category and where, how prices per unit move, how
// often each item is bought, and how the child's use compares with the usual for the age. Pure; from purchases only.
import { defaultDailyRate } from "./purchases.ts";
import { daysBetween, ITEM_CATEGORIES, purchasesOf, type ItemCategory, type ItemEstimate, type ShoppingItem } from "./items.ts";
import type { Purchase } from "./purchases.ts";

export interface MonthSpend { month: string; total: number; byCategory: Partial<Record<ItemCategory, number>> }

const monthOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Last `months` months (oldest first, current included) of purchase spend per item category. */
export function monthlySpend(purchases: Purchase[], items: ShoppingItem[], months = 6, now = new Date()): MonthSpend[] {
  const categoryOf = new Map(items.map((item) => [item.id, item.category]));
  const out: MonthSpend[] = [];
  for (let back = months - 1; back >= 0; back--) out.push({ month: monthOf(new Date(now.getFullYear(), now.getMonth() - back, 1)), total: 0, byCategory: {} });
  const index = new Map(out.map((line, position) => [line.month, position]));
  for (const purchase of purchases) {
    const position = index.get(purchase.purchasedOn.slice(0, 7));
    if (position === undefined) continue;
    const category = (purchase.itemId && categoryOf.get(purchase.itemId)) || (purchase.productId ? "diapers" : "other");
    const line = out[position];
    line.total += purchase.amount;
    line.byCategory[category] = (line.byCategory[category] ?? 0) + purchase.amount;
  }
  return out;
}

/** Categories present in the spend lines, in the fixed category order (legend + stacking order). */
export const categoriesIn = (lines: MonthSpend[]) => ITEM_CATEGORIES.filter((category) => lines.some((line) => line.byCategory[category]));

/** Where the money went since `since`: top merchants by amount, the rest as "Khác". */
export function merchantShare(purchases: Purchase[], since: string, top = 3): Array<{ merchant: string; amount: number; share: number }> {
  const totals = new Map<string, number>();
  for (const purchase of purchases) if (purchase.purchasedOn >= since) totals.set(purchase.merchant ?? "Không rõ", (totals.get(purchase.merchant ?? "Không rõ") ?? 0) + purchase.amount);
  const all = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const sum = all.reduce((acc, [, amount]) => acc + amount, 0);
  if (!sum) return [];
  const head = all.slice(0, top); const rest = all.slice(top).reduce((acc, [, amount]) => acc + amount, 0);
  return [...head, ...(rest ? [["Khác", rest] as [string, number]] : [])].map(([merchant, amount]) => ({ merchant, amount, share: Math.round(amount / sum * 100) }));
}

/** Price per unit of each purchase of the item, oldest first. */
export const unitPrices = (item: ShoppingItem, purchases: Purchase[]) => purchasesOf(item, purchases).map((purchase) => ({ on: purchase.purchasedOn, price: purchase.amount / Math.max(1, purchase.unitCount) }));

/** % change of the last price per unit against the average of the earlier ones; null with fewer than 2 purchases. */
export function unitPriceTrend(item: ShoppingItem, purchases: Purchase[]): number | null {
  const prices = unitPrices(item, purchases).map((entry) => entry.price);
  if (prices.length < 2) return null;
  const earlier = prices.slice(Math.max(0, prices.length - 4), -1);
  const base = earlier.reduce((acc, price) => acc + price, 0) / earlier.length;
  return base ? Math.round((prices.at(-1)! / base - 1) * 100) : null;
}

/** Median days between purchases of the item; null with fewer than 2. */
export function cadenceDays(item: ShoppingItem, purchases: Purchase[]): number | null {
  const own = purchasesOf(item, purchases);
  const gaps = own.slice(1).map((purchase, index) => daysBetween(own[index].purchasedOn, purchase.purchasedOn)).filter((gap) => gap > 0).sort((a, b) => a - b);
  if (!gaps.length) return null;
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[middle] : Math.round((gaps[middle - 1] + gaps[middle]) / 2);
}

/** Diapers only: the learned rate against the usual for the child's age (±15% counts as "khớp"). */
export function benchmarkNote(estimate: ItemEstimate, ageMonths: number | undefined, who = "bé"): string | null {
  if (estimate.item.category !== "diapers" || estimate.rateSource !== "learned" || ageMonths === undefined) return null;
  const usual = defaultDailyRate(ageMonths);
  const ratio = estimate.dailyRate / usual;
  const rate = `${Math.round(estimate.dailyRate * 10) / 10}`.replace(".", ",");
  if (Math.abs(ratio - 1) <= 0.15) return `${who} dùng ${rate} miếng/ngày — khớp mức thường gặp ở tuổi này (~${usual}).`;
  return `${who} dùng ${rate} miếng/ngày — ${ratio > 1 ? "nhiều" : "ít"} hơn khoảng ${Math.round(Math.abs(ratio - 1) * 100)}% so với mức thường gặp ở tuổi này (~${usual}).`;
}
