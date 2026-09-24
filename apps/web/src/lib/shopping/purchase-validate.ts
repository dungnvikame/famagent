import { isUuid } from "./item-validate.ts";
import { PURCHASE_SOURCES, type Purchase, type PurchaseSource } from "./purchases.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const opt = (value: unknown, max: number) => value === undefined || value === null || value === "" ? undefined : text(value, max) ?? undefined;
const int = (value: unknown) => typeof value === "number" && Number.isInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;

/** Body of POST /api/purchases → a Purchase or null. The item link is checked by the route (it may be created in the same request). */
export function validPurchase(input: unknown, id = crypto.randomUUID()): Purchase | null {
  if (!isRecord(input)) return null;
  const productName = text(input.productName, 200);
  const amount = int(input.amount); const packs = int(input.packs ?? 1); const unitCount = int(input.unitCount);
  if (!productName || amount === null || amount < 0 || amount > 100_000_000_000 || packs === null || packs < 1 || packs > 50 || unitCount === null || unitCount < 1 || unitCount > 100_000) return null;
  if (typeof input.purchasedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.purchasedOn) || Number.isNaN(Date.parse(input.purchasedOn))) return null;
  if (input.itemId !== undefined && !isUuid(input.itemId)) return null;
  const source = input.source === undefined ? "catalog" : PURCHASE_SOURCES.includes(input.source as PurchaseSource) ? input.source as PurchaseSource : null;
  if (!source) return null;
  return { id: isUuid(input.id) ? input.id : id, itemId: input.itemId as string | undefined, productId: opt(input.productId, 100), productName, brand: opt(input.brand, 80), variantId: opt(input.variantId, 100), offerId: opt(input.offerId, 100), merchant: opt(input.merchant, 80), amount, packs, unitCount, purchasedOn: input.purchasedOn, childId: isUuid(input.childId) ? input.childId : undefined, source };
}
