import type { Purchase } from "./purchases.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const opt = (value: unknown, max: number) => value === undefined || value === null || value === "" ? undefined : text(value, max) ?? undefined;
const int = (value: unknown) => typeof value === "number" && Number.isInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;

/** Body of POST /api/purchases → a Purchase or null. */
export function validPurchase(input: unknown, id = crypto.randomUUID()): Purchase | null {
  if (!isRecord(input)) return null;
  const productId = text(input.productId, 100); const productName = text(input.productName, 200);
  const amount = int(input.amount); const packs = int(input.packs ?? 1); const unitCount = int(input.unitCount);
  if (!productId || !productName || amount === null || amount < 0 || amount > 100_000_000_000 || packs === null || packs < 1 || packs > 50 || unitCount === null || unitCount < 1 || unitCount > 100_000) return null;
  if (typeof input.purchasedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.purchasedOn) || Number.isNaN(Date.parse(input.purchasedOn))) return null;
  const rate = input.dailyRate === undefined || input.dailyRate === null || input.dailyRate === "" ? undefined : Number(input.dailyRate);
  if (rate !== undefined && !(rate > 0 && rate <= 100)) return null;
  return { id: uuid(input.id) ? input.id : id, productId, productName, brand: opt(input.brand, 80), variantId: opt(input.variantId, 100), offerId: opt(input.offerId, 100), merchant: opt(input.merchant, 80), amount, packs, unitCount, purchasedOn: input.purchasedOn, childId: uuid(input.childId) ? input.childId : undefined, dailyRate: rate };
}
