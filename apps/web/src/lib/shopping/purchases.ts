// Purchase history + consumption estimate (SPEC_V2 §13, §38): "Merries L64 bought 12/09 → ~4 days left".
// Pure functions; persistence lives in purchase-store-server.ts (Supabase) and purchase-client.ts (browser).

export interface Purchase {
  id: string;
  productId: string;
  productName: string;
  brand?: string;
  variantId?: string;
  offerId?: string;
  merchant?: string;
  /** VND paid in total. */
  amount: number;
  packs: number;
  /** Total pieces added (packs × pieces per pack). */
  unitCount: number;
  /** YYYY-MM-DD */
  purchasedOn: string;
  childId?: string;
  /** Pieces per day override; undefined = default by child age. */
  dailyRate?: number;
  /** Linked ledger entry (Finance) when the event was processed. */
  transactionId?: string;
}

export interface StockEstimate {
  productId: string;
  productName: string;
  brand?: string;
  /** Pieces estimated on hand right now (≥ 0). */
  remaining: number;
  dailyRate: number;
  /** Whole days until the estimate reaches zero; 0 = out. */
  daysLeft: number;
  /** YYYY-MM-DD */
  runsOutOn: string;
  lastPurchase: Purchase;
  purchaseCount: number;
  /** Confidence: "default" rate by age vs. "set" by the user. */
  rateSource: "default" | "set";
}

const DAY_MS = 86_400_000;
export const REORDER_WINDOW_DAYS = 7;

/** Diaper changes per day by age — conservative averages used until the family sets its own rate. */
export function defaultDailyRate(ageMonths?: number): number {
  if (ageMonths === undefined) return 6;
  if (ageMonths < 3) return 9;
  if (ageMonths < 6) return 8;
  if (ageMonths < 12) return 6;
  if (ageMonths < 24) return 5;
  return 4;
}

const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const dayStart = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

/**
 * Stock per product: pieces bought since the first purchase minus consumption since that day. Multiple
 * purchases stack (buying twice in a month means a bigger pile, not a reset). Consumption before the
 * first purchase is unknown, so the estimate starts from zero stock on that day.
 */
export function estimateStock(purchases: Purchase[], rateFor: (purchase: Purchase) => number, now = new Date()): StockEstimate[] {
  const byProduct = new Map<string, Purchase[]>();
  for (const purchase of purchases) byProduct.set(purchase.productId, [...(byProduct.get(purchase.productId) ?? []), purchase]);
  const today = dayStart(localDate(now));
  const out: StockEstimate[] = [];
  for (const [productId, items] of byProduct) {
    const sorted = [...items].sort((a, b) => a.purchasedOn.localeCompare(b.purchasedOn));
    const last = sorted.at(-1)!;
    const rate = last.dailyRate ?? rateFor(last);
    const bought = sorted.reduce((acc, item) => acc + item.unitCount, 0);
    const days = Math.max(0, Math.floor((today.getTime() - dayStart(sorted[0].purchasedOn).getTime()) / DAY_MS));
    const remaining = Math.max(0, Math.round(bought - days * rate));
    const daysLeft = Math.floor(remaining / rate);
    const runsOut = new Date(today.getTime() + daysLeft * DAY_MS);
    out.push({ productId, productName: last.productName, brand: last.brand, remaining, dailyRate: rate, daysLeft, runsOutOn: localDate(runsOut), lastPurchase: last, purchaseCount: sorted.length, rateSource: last.dailyRate ? "set" : "default" });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Items to surface on Home/Shopping: running low within the reorder window (or already out). */
export const runningLow = (estimates: StockEstimate[]) => estimates.filter((item) => item.daysLeft <= REORDER_WINDOW_DAYS);

/** Ledger entry created by PURCHASE_COMPLETED (Finance side of the event). */
export function transactionForPurchase(purchase: Purchase, forChild: boolean, id: string) {
  return { id, occurredOn: purchase.purchasedOn, content: `${purchase.productName}${purchase.packs > 1 ? ` ×${purchase.packs}` : ""}`, category: forChild ? "Con" : "Mua sắm", kind: "expense" as const, amount: purchase.amount, forChild, childId: purchase.childId, note: purchase.merchant ? `Mua tại ${purchase.merchant}` : undefined, source: "purchase" as const };
}

/** Budget context for a price the family is about to spend (SPEC_V2 §14). */
export function budgetHint(price: number, category: { spent: number; limit?: number } | undefined, remainingOfPlan: number | undefined, categoryName = "Con"): string | null {
  if (category?.limit) {
    const left = category.limit - category.spent;
    if (price > left) return `Khoản ${Math.round(price / 1000)}K này vượt phần còn lại của ngân sách ${categoryName} tháng này (${Math.round(Math.max(0, left) / 1000)}K). Cân nhắc gói nhỏ hơn hoặc đợi tháng sau.`;
    return `Trong ngân sách ${categoryName}: còn ${Math.round(left / 1000)}K tháng này, sau khoản này còn ${Math.round((left - price) / 1000)}K.`;
  }
  if (remainingOfPlan !== undefined) return price > remainingOfPlan ? `Khoản này vượt phần còn lại của kế hoạch chi tháng (${Math.round(Math.max(0, remainingOfPlan) / 1000)}K).` : `Sau khoản này, kế hoạch chi tháng còn ${Math.round((remainingOfPlan - price) / 1000)}K.`;
  return null;
}
