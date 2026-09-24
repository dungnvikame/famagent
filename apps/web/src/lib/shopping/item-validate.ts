import { ITEM_CATEGORIES, ITEM_STATUSES, type ItemCategory, type ItemStatus, type ShoppingItem, type StockCheck } from "./items.ts";
import { PLAN_REASONS, PLAN_STATUSES, type PlanEntry, type PlanReason, type PlanStatus } from "./plan.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const opt = (value: unknown, max: number) => value === undefined || value === null || value === "" ? undefined : text(value, max) ?? undefined;
const optInt = (value: unknown, min: number, max: number) => { const number = typeof value === "string" ? Number(value) : value; return typeof number === "number" && Number.isInteger(number) && number >= min && number <= max ? number : undefined; };

/** Body item of PUT /api/shopping/items (and the `item` of POST /api/purchases) → a ShoppingItem or null. */
export function validItem(input: unknown): ShoppingItem | null {
  if (!isRecord(input) || !isUuid(input.id)) return null;
  const name = text(input.name, 120); const unit = text(input.unit, 20);
  const category = ITEM_CATEGORIES.includes(input.category as ItemCategory) ? input.category as ItemCategory : null;
  const status = input.status === undefined ? "active" : ITEM_STATUSES.includes(input.status as ItemStatus) ? input.status as ItemStatus : null;
  if (!name || !unit || !category || !status) return null;
  const rate = input.dailyRate === undefined || input.dailyRate === null || input.dailyRate === "" ? undefined : Number(input.dailyRate);
  if (rate !== undefined && !(rate > 0 && rate <= 1000)) return null;
  return { id: input.id, name, category, unit, packSize: optInt(input.packSize, 1, 100_000), brand: opt(input.brand, 80), merchant: opt(input.merchant, 80), dailyRate: rate, childId: isUuid(input.childId) ? input.childId : undefined, productId: opt(input.productId, 100), status };
}

const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** PUT /api/shopping/checks → a "còn không?" answer. */
export function validCheck(input: unknown): StockCheck | null {
  if (!isRecord(input) || !isUuid(input.id) || !isUuid(input.itemId) || !isDay(input.checkedOn)) return null;
  const remaining = Number(input.remaining);
  return Number.isFinite(remaining) && remaining >= 0 && remaining <= 1_000_000 ? { id: input.id, itemId: input.itemId, checkedOn: input.checkedOn, remaining: Math.round(remaining * 100) / 100 } : null;
}

/** PUT /api/shopping/plan → one monthly plan entry. */
export function validPlanEntry(input: unknown): PlanEntry | null {
  if (!isRecord(input) || !isUuid(input.id) || typeof input.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) return null;
  const name = text(input.name, 120); const packs = optInt(input.packs, 1, 50) ?? (input.packs === undefined ? 1 : undefined);
  const reason = PLAN_REASONS.includes(input.reason as PlanReason) ? input.reason as PlanReason : null;
  const status = PLAN_STATUSES.includes(input.status as PlanStatus) ? input.status as PlanStatus : null;
  if (!name || packs === undefined || !reason || !status || (input.itemId !== undefined && input.itemId !== null && !isUuid(input.itemId))) return null;
  return { id: input.id, month: input.month, itemId: isUuid(input.itemId) ? input.itemId : undefined, stageKey: opt(input.stageKey, 120), name, packs, estAmount: optInt(input.estAmount, 0, 100_000_000_000), reason, status };
}

/** PUT /api/shopping/dismissed → a ledger expense the family said is not household shopping. */
export function validDismissed(input: unknown): { transactionId: string } | null {
  return isRecord(input) && isUuid(input.transactionId) ? { transactionId: input.transactionId } : null;
}
