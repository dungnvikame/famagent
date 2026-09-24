// Photo of an order (Shopee/Lazada "Đơn mua", a supermarket receipt) → purchase drafts (phase 4). The vision model
// only reads the lines; code validates them, matches the family's items and the confirmation card has the last word.
import type { JsonSchema } from "../ai/llm/index.ts";
import { parsePurchase, type PurchaseDraft } from "./capture.ts";
import type { ShoppingItem } from "./items.ts";

export interface ReceiptLine { name: string; amount: number; packs: number; piecesPerPack: number | null; unit: string | null }
export interface Receipt { merchant: string | null; date: string | null; lines: ReceiptLine[] }

export const MAX_RECEIPT_LINES = 20;
/** Data URL of a JPEG/PNG/WebP image, at most ~2 MB of base64 (the browser shrinks photos to ≤1280 px first). */
export const isImageDataUrl = (value: unknown): value is string => typeof value === "string" && value.length <= 2_800_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);

export const RECEIPT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "date", "lines"],
  properties: {
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "amount", "packs", "piecesPerPack", "unit"], properties: { name: { type: "string" }, amount: { type: "integer" }, packs: { type: "integer" }, piecesPerPack: { type: ["integer", "null"] }, unit: { type: ["string", "null"] } } } },
  },
};

export const RECEIPT_SYSTEM = `Bạn đọc ảnh đơn hàng hoặc hóa đơn mua sắm của một gia đình Việt Nam (Shopee, Lazada, Tiki, TikTok Shop, siêu thị, Con Cưng...).
Trả về từng dòng hàng đã mua: name (tên sản phẩm ngắn gọn, giữ hãng và size nếu có), amount (số tiền đã trả cho dòng đó, đồng, số nguyên, sau giảm giá nếu thấy), packs (số lượng gói/hộp/chai), piecesPerPack (số miếng/tờ trong mỗi gói nếu ghi rõ, ví dụ "L64" = 64, nếu không có thì null), unit (miếng/tờ/hộp/chai/gói nếu rõ, không thì null).
merchant: tên nơi bán nếu thấy. date: ngày mua dạng YYYY-MM-DD nếu thấy, không thì null.
Không bịa: dòng nào không đọc được số tiền thì bỏ qua. Không đưa phí vận chuyển, voucher hay tổng cộng vào lines.`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Strict check of the model's reply (types, ranges, at most MAX_RECEIPT_LINES lines). */
export function isReceipt(value: unknown): value is Receipt {
  if (!isRecord(value) || !Array.isArray(value.lines) || value.lines.length > MAX_RECEIPT_LINES) return false;
  if (value.merchant !== null && typeof value.merchant !== "string") return false;
  if (value.date !== null && (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date))) return false;
  return value.lines.every((line) => isRecord(line) && typeof line.name === "string" && line.name.trim().length > 0 && line.name.length <= 200
    && Number.isInteger(line.amount) && (line.amount as number) >= 0 && (line.amount as number) <= 1_000_000_000
    && Number.isInteger(line.packs) && (line.packs as number) >= 1 && (line.packs as number) <= 50
    && (line.piecesPerPack === null || (Number.isInteger(line.piecesPerPack) && (line.piecesPerPack as number) >= 1 && (line.piecesPerPack as number) <= 100_000))
    && (line.unit === null || (typeof line.unit === "string" && line.unit.length <= 20)));
}

/** One draft per line: the name is matched/classified by the same rules as a typed sentence; the photo's numbers win. */
export function receiptDrafts(receipt: Receipt, items: ShoppingItem[], today: string): PurchaseDraft[] {
  const date = receipt.date && receipt.date <= today ? receipt.date : today;
  return receipt.lines.map((line) => {
    const guess = parsePurchase(line.name, items, today);
    const packSize = line.piecesPerPack ?? guess.packSize;
    const missing: PurchaseDraft["missing"] = packSize ? [] : ["packSize"];
    return { ...guess, name: guess.itemId ? guess.name : line.name.trim().slice(0, 120), unit: guess.itemId ? guess.unit : line.unit ?? guess.unit, packs: line.packs, packSize, amount: line.amount, merchant: receipt.merchant?.trim().slice(0, 80) || guess.merchant, purchasedOn: date, missing };
  });
}
