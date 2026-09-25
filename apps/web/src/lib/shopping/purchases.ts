// Purchase history (SPEC_V2 §13, §38) and the Finance side of PURCHASE_COMPLETED. Stock estimates per household item
// live in items.ts. Pure functions; persistence lives in purchase-store-server.ts (Supabase) and purchase-client.ts.

import { vnd } from "../catalog/format.ts";

export const PURCHASE_SOURCES = ["catalog", "chat", "quick", "ledger", "photo", "plan"] as const;
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

export interface Purchase {
  id: string;
  /** Household item this purchase restocks (lib/shopping/items). Optional only for legacy browser rows. */
  itemId?: string;
  /** Catalog product, when bought from a FamAgent recommendation or product page. */
  productId?: string;
  productName: string;
  brand?: string;
  variantId?: string;
  offerId?: string;
  merchant?: string;
  /** VND paid in total. */
  amount: number;
  packs: number;
  /** Total units added (packs × units per pack). */
  unitCount: number;
  /** YYYY-MM-DD */
  purchasedOn: string;
  childId?: string;
  /** Legacy per-purchase rate; the family's rate now lives on the item. */
  dailyRate?: number;
  /** Linked ledger entry (Finance) when the event was processed. */
  transactionId?: string;
  /** Where the purchase was captured. */
  source?: PurchaseSource;
}

export const REORDER_WINDOW_DAYS = 7;

/** Diaper changes per day by age — conservative averages used until the family's own history says otherwise. */
export function defaultDailyRate(ageMonths?: number): number {
  if (ageMonths === undefined) return 6;
  if (ageMonths < 3) return 9;
  if (ageMonths < 6) return 8;
  if (ageMonths < 12) return 6;
  if (ageMonths < 24) return 5;
  return 4;
}

/** Ledger entry created by PURCHASE_COMPLETED (Finance side of the event). */
export function transactionForPurchase(purchase: Purchase, forChild: boolean, id: string) {
  return { id, occurredOn: purchase.purchasedOn, content: `${purchase.productName}${purchase.packs > 1 ? ` ×${purchase.packs}` : ""}`, category: forChild ? "Con" : "Mua sắm", kind: "expense" as const, amount: purchase.amount, forChild, childId: purchase.childId, note: purchase.merchant ? `Mua tại ${purchase.merchant}` : undefined, source: "purchase" as const };
}

/** Budget context for a price the family is about to spend (SPEC_V2 §14). */
export function budgetHint(price: number, category: { spent: number; limit?: number } | undefined, remainingOfPlan: number | undefined, categoryName = "Con"): string | null {
  if (category?.limit) {
    const left = category.limit - category.spent;
    if (price > left) return `Khoản ${vnd(price)} này vượt phần còn lại của ngân sách ${categoryName} tháng này (${vnd(Math.max(0, left))}). Cân nhắc gói nhỏ hơn hoặc đợi tháng sau.`;
    return `Trong ngân sách ${categoryName}: còn ${vnd(left)} tháng này, sau khoản này còn ${vnd((left - price))}.`;
  }
  if (remainingOfPlan !== undefined) return price > remainingOfPlan ? `Khoản này vượt phần còn lại của kế hoạch chi tháng (${vnd(Math.max(0, remainingOfPlan))}).` : `Sau khoản này, kế hoạch chi tháng còn ${vnd((remainingOfPlan - price))}.`;
  return null;
}
