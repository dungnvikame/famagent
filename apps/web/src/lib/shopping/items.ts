// "What our family uses" (plans/260924-1431-shopping-plan-redesign): household items, the stock left of each and
// how fast the family goes through it. Pure functions; persistence lives in item-store-server.ts / item-client.ts.
import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { FamilyProfile } from "../experience/types.ts";
import { defaultDailyRate, REORDER_WINDOW_DAYS, type Purchase } from "./purchases.ts";

export const ITEM_CATEGORIES = ["diapers", "wipes", "milk", "solids", "hygiene", "household", "other"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ItemCategory, string> = { diapers: "Bỉm", wipes: "Khăn ướt", milk: "Sữa", solids: "Ăn dặm", hygiene: "Vệ sinh cho bé", household: "Đồ gia đình", other: "Khác" };
export const DEFAULT_UNIT: Record<ItemCategory, string> = { diapers: "miếng", wipes: "tờ", milk: "hộp", solids: "gói", hygiene: "chai", household: "gói", other: "gói" };
/** Baby categories count as "chi cho con" in the ledger by default. */
export const CHILD_CATEGORIES: ReadonlySet<ItemCategory> = new Set(["diapers", "wipes", "milk", "solids", "hygiene"]);
export const ITEM_STATUSES = ["active", "paused", "outgrown"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface ShoppingItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** What one unit is ("miếng", "tờ", "hộp"). */
  unit: string;
  /** Units per pack, when known. */
  packSize?: number;
  brand?: string;
  merchant?: string;
  /** Units per day set by the family; undefined = learned or default. */
  dailyRate?: number;
  childId?: string;
  /** Catalog product (diapers) for "find an alternative". */
  productId?: string;
  status: ItemStatus;
}

/** "Còn không?" answer: on that day the family had about `remaining` units (phase 2). */
export interface StockCheck { id: string; itemId: string; checkedOn: string; remaining: number; /** ISO time the answer was given (orders same-day corrections). */ createdAt?: string }
const byCheckOrder = (a: StockCheck, b: StockCheck) => a.checkedOn.localeCompare(b.checkedOn) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

export type RateSource = "default" | "learned" | "set";

export interface ItemEstimate {
  item: ShoppingItem;
  /** False until there is a purchase or a stock check: nothing to count from yet. */
  known: boolean;
  remaining: number;
  dailyRate: number;
  rateSource: RateSource;
  /** Whole days until zero; null when unknown. */
  daysLeft: number | null;
  /** YYYY-MM-DD; null when unknown. */
  runsOutOn: string | null;
  lastPurchase?: Purchase;
  purchaseCount: number;
  /** VND per pack on the last purchase (for "Mua lại ~690k"). */
  lastPackPrice?: number;
}

const DAY_MS = 86_400_000;
export const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const dayStart = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (from: string, to: string) => Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / DAY_MS);
export const addDays = (iso: string, days: number) => localDate(new Date(dayStart(iso).getTime() + days * DAY_MS));

/** Default units/day before the family's own history says otherwise. Non-baby items: one pack per 30 days. */
export function defaultRate(item: Pick<ShoppingItem, "category" | "packSize">, ageMonths?: number): number {
  if (item.category === "diapers") return defaultDailyRate(ageMonths);
  if (item.category === "wipes") return 10;
  if (item.category === "milk") return ageMonths === undefined || ageMonths >= 12 ? 0.08 : ageMonths < 6 ? 0.14 : 0.1;
  return Math.round(((item.packSize ?? 1) / 30) * 1000) / 1000;
}

/** Default-rate resolver: the item's child (or the first child) sets the age. */
export const itemRateResolver = (profile: FamilyProfile | null, now = new Date()) => (item: ShoppingItem) => {
  const child = profile?.children.find((entry) => entry.id === item.childId) ?? profile?.children[0];
  return defaultRate(item, child ? childAgeMonths(child, now) : undefined);
};

/** Purchases for an item; legacy browser rows without itemId match by catalog product. */
export const purchasesOf = (item: ShoppingItem, purchases: Purchase[]) =>
  purchases.filter((purchase) => purchase.itemId ? purchase.itemId === item.id : Boolean(item.productId) && purchase.productId === item.productId)
    .sort((a, b) => a.purchasedOn.localeCompare(b.purchasedOn));

/**
 * The family's own rate. Two stock checks ≥3 days apart are the best evidence (units used between them); otherwise
 * the gaps between purchases, assuming each rebuy happens roughly when the previous stock ran out. A rebuy that comes
 * earlier than 40% of the expected gap is stocking up, not consumption, and is skipped.
 */
export function learnedRate(purchases: Purchase[], checks: StockCheck[] = [], fallback?: number): number | null {
  const sortedChecks = [...checks].sort(byCheckOrder);
  for (let index = sortedChecks.length - 1; index > 0; index--) {
    const to = sortedChecks[index];
    const from = sortedChecks.slice(0, index).reverse().find((check) => daysBetween(check.checkedOn, to.checkedOn) >= 3);
    if (!from) continue;
    const bought = purchases.filter((purchase) => purchase.purchasedOn >= from.checkedOn && purchase.purchasedOn < to.checkedOn).reduce((sum, purchase) => sum + purchase.unitCount, 0);
    const used = from.remaining + bought - to.remaining;
    if (used > 0) return round(used / daysBetween(from.checkedOn, to.checkedOn));
  }
  const byDay = new Map<string, number>();
  for (const purchase of purchases) byDay.set(purchase.purchasedOn, (byDay.get(purchase.purchasedOn) ?? 0) + purchase.unitCount);
  const sorted = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([purchasedOn, unitCount]) => ({ purchasedOn, unitCount }));
  let units = 0; let days = 0;
  for (let index = 1; index < sorted.length; index++) {
    const gap = daysBetween(sorted[index - 1].purchasedOn, sorted[index].purchasedOn);
    const expected = fallback ? sorted[index - 1].unitCount / fallback : 0;
    if (gap < 1 || (expected && gap < expected * 0.4)) continue;
    units += sorted[index - 1].unitCount; days += gap;
  }
  return days >= 3 && units > 0 ? round(units / days) : null;
}
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Stock per item. Counting starts at the latest stock check (its remaining, plus purchases after it) or, without one,
 * at zero on the first purchase; consumption runs at the family's set rate, then the learned one, then the default.
 */
export function estimateItems(items: ShoppingItem[], purchases: Purchase[], rateFor: (item: ShoppingItem) => number, now = new Date(), checks: StockCheck[] = []): ItemEstimate[] {
  const today = localDate(now);
  const out = items.filter((item) => item.status === "active").map((item): ItemEstimate => {
    const own = purchasesOf(item, purchases);
    const ownChecks = checks.filter((check) => check.itemId === item.id && check.checkedOn <= today);
    const fallback = rateFor(item);
    const learned = item.dailyRate ? null : learnedRate(own, ownChecks, fallback);
    const dailyRate = item.dailyRate ?? learned ?? fallback;
    const rateSource: RateSource = item.dailyRate ? "set" : learned ? "learned" : "default";
    const last = own.at(-1);
    const lastPackPrice = last ? Math.round(last.amount / Math.max(1, last.packs)) : undefined;
    const anchor = ownChecks.sort(byCheckOrder).at(-1);
    // Purchases on the answer's day count after it: the usual order is "hết rồi", then buying.
    const start = anchor ? { on: anchor.checkedOn, units: anchor.remaining, after: (purchase: Purchase) => purchase.purchasedOn >= anchor.checkedOn }
      : own.length ? { on: own[0].purchasedOn, units: 0, after: () => true } : null;
    if (!start) return { item, known: false, remaining: 0, dailyRate, rateSource, daysLeft: null, runsOutOn: null, purchaseCount: 0 };
    // Walk forward day by day in segments so stock never goes below zero between purchases (running out, then rebuying).
    let units = start.units; let cursor = start.on;
    for (const purchase of own.filter(start.after)) {
      units = Math.max(0, units - dailyRate * Math.max(0, daysBetween(cursor, purchase.purchasedOn))) + purchase.unitCount;
      cursor = purchase.purchasedOn;
    }
    // Days left come from the unrounded stock so slow items (1 can / 30 days) are not rounded to a whole can.
    const left = Math.max(0, units - dailyRate * Math.max(0, daysBetween(cursor, today)));
    const remaining = Math.round(left);
    const daysLeft = Math.floor(left / dailyRate + 1e-9);
    return { item, known: true, remaining, dailyRate, rateSource, daysLeft, runsOutOn: addDays(today, daysLeft), lastPurchase: last, purchaseCount: own.length, lastPackPrice };
  });
  return out.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.item.name.localeCompare(b.item.name, "vi"));
}

/** Items to surface on Home/Shopping: running low within the reorder window (or already out). */
export const runningLow = (estimates: ItemEstimate[]) => estimates.filter((estimate) => estimate.daysLeft !== null && estimate.daysLeft <= REORDER_WINDOW_DAYS);

/** Mức "còn không?" → units on hand, from what the family taps (phase 2). */
export const STOCK_LEVELS = [{ id: "out", label: "Hết rồi" }, { id: "low", label: "Còn ít" }, { id: "half", label: "Còn khoảng nửa" }, { id: "plenty", label: "Còn nhiều" }] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number]["id"];
export function levelToRemaining(level: StockLevel, estimate: Pick<ItemEstimate, "remaining" | "dailyRate" | "item">): number {
  const pack = estimate.item.packSize ?? Math.max(1, Math.round(estimate.dailyRate * 14));
  if (level === "out") return 0;
  if (level === "low") return Math.min(estimate.remaining || Infinity, Math.round(Math.max(estimate.dailyRate * 3, pack * 0.1) * 100) / 100);
  if (level === "half") return Math.round(pack / 2);
  return Math.max(estimate.remaining, pack);
}

/** Loose name match (no diacritics, token overlap) used to find an existing item for a typed purchase. */
export const normalizeText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
const tokens = (text: string) => normalizeText(text).split(/[^a-z0-9]+/).filter((token) => token.length > 0);
export function matchItem(text: string, items: ShoppingItem[]): ShoppingItem | undefined {
  const words = new Set(tokens(text));
  let best: { item: ShoppingItem; score: number } | undefined;
  for (const item of items) {
    const name = tokens(`${item.name} ${item.brand ?? ""}`);
    if (!name.length) continue;
    const hits = name.filter((token) => words.has(token)).length;
    const score = hits / new Set(name).size;
    if (hits >= 1 && score >= 0.5 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

/** Stock lines for the agent's reorder / "còn không?" answers (lib/ai/shopping/pipeline StockLine). */
export const stockLines = (estimates: ItemEstimate[]) => estimates.filter((estimate) => estimate.known && estimate.daysLeft !== null && estimate.lastPurchase)
  .map((estimate) => ({ productName: estimate.item.name, brand: estimate.item.brand, daysLeft: estimate.daysLeft!, remaining: estimate.remaining, lastPurchasedOn: estimate.lastPurchase!.purchasedOn }));
