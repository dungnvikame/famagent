import { ITEM_CATEGORIES, ITEM_STATUSES, type ItemCategory, type ItemStatus, type ShoppingItem } from "./items.ts";

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
