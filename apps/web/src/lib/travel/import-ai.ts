// "Nhập từ tour": the family pastes a tour programme (or photographs it) and the model splits it into itinerary
// entries per day plus any "đồ cần chuẩn bị" list it contains. Nothing is invented — only what the text/photo says —
// and code bounds every field; the family reviews a checked preview before anything is added (lesson G3).
import type { JsonSchema } from "../ai/llm/index.ts";
import { packingKey, type PackingSuggestion } from "./packing-template.ts";
import { PACKING_CATEGORIES, type PackingCategory } from "./types.ts";

export const MAX_IMPORT_TEXT = 8_000;
export const MAX_IMPORT_ENTRIES = 60;
export const MAX_IMPORT_PACKING = 40;

export interface ImportedEntry {
  /** 1-based day of the trip; undefined = the text did not say which day (lands in "chưa xếp ngày"). */
  day?: number;
  timeLabel?: string;
  title: string;
  note?: string;
  /** VND the text attaches to this activity (0 = none mentioned). */
  estAmount: number;
}

export interface TripImportResult { itinerary: ImportedEntry[]; packing: PackingSuggestion[] }

export interface ImportRequest {
  destination: string;
  /** Length of the trip; parsed days are clamped into 1..days (outside → unscheduled). */
  days: number;
  text?: string;
  /** data:image/jpeg… of the tour programme; the route validates size/format. */
  image?: string;
}

export const IMPORT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itinerary", "packing"],
  properties: {
    itinerary: { type: "array", items: { type: "object", additionalProperties: false, required: ["title"], properties: { day: { type: "integer" }, time: { type: "string" }, title: { type: "string" }, note: { type: "string" }, estAmount: { type: "integer" } } } },
    packing: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "category"], properties: { name: { type: "string" }, category: { type: "string", enum: [...PACKING_CATEGORIES] }, qty: { type: "integer" } } } },
  },
};

export function importSystem(request: ImportRequest): string {
  return `Bạn đọc chương trình tour / lịch trình du lịch (văn bản dán hoặc ảnh chụp) của một gia đình Việt Nam đi ${request.destination}, chuyến kéo dài ${request.days} ngày, và tách thành dữ liệu có cấu trúc.
QUY TẮC: chỉ lấy những gì có trong nội dung, KHÔNG bịa thêm.
- itinerary: mỗi hoạt động một mục. day = ngày thứ mấy của chuyến (1..${request.days}; "NGÀY 01", "Ngày 1:" → 1); không rõ ngày thì bỏ trống day. time = giờ nếu có ("08:00") hoặc buổi ("Sáng"/"Chiều"/"Tối"); title ngắn gọn (≤100 ký tự, vd "Bà Nà Hills"); note = chi tiết đáng nhớ, ngắn (≤300 ký tự: điểm đón, món ăn, lưu ý); estAmount = số tiền VND gắn với hoạt động đó nếu nội dung ghi rõ (vé, phụ thu), không có thì 0. Ăn sáng tại khách sạn, nhận/trả phòng cũng là hoạt động nếu được liệt kê.
- packing: CHỈ khi nội dung có mục đồ mang theo / cần chuẩn bị; mỗi món một mục, category đúng một trong: ${PACKING_CATEGORIES.join(", ")}. Không tự nghĩ thêm đồ.
Nội dung không phải lịch trình du lịch → trả hai mảng rỗng.`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Request body from the browser → a clean request (text and/or image required), or null. The route checks the image data URL. */
export function validImportRequest(input: unknown): ImportRequest | null {
  if (!isRecord(input)) return null;
  const destination = typeof input.destination === "string" && input.destination.trim() && input.destination.length <= 120 ? input.destination.trim() : null;
  const days = Number(input.days);
  const text = typeof input.text === "string" && input.text.trim() ? input.text.trim().slice(0, MAX_IMPORT_TEXT) : undefined;
  const image = typeof input.image === "string" && input.image ? input.image : undefined;
  if (!destination || !Number.isInteger(days) || days < 1 || days > 60 || (!text && !image)) return null;
  return { destination, days, text, image };
}

const trimTo = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

/** Model reply → bounded entries (day clamped into the trip or unscheduled) and packing deduped against the checklist. */
export function cleanImport(value: unknown, request: ImportRequest, existingPacking: string[]): TripImportResult {
  const itinerary: ImportedEntry[] = [];
  const packing: PackingSuggestion[] = [];
  if (isRecord(value) && Array.isArray(value.itinerary)) {
    for (const item of value.itinerary) {
      if (itinerary.length >= MAX_IMPORT_ENTRIES || !isRecord(item)) continue;
      const title = trimTo(item.title, 120);
      if (!title) continue;
      const day = Number(item.day);
      const amount = Number(item.estAmount);
      itinerary.push({
        day: Number.isInteger(day) && day >= 1 && day <= request.days ? day : undefined,
        timeLabel: trimTo(item.time, 20),
        title,
        note: trimTo(item.note, 500),
        estAmount: Number.isFinite(amount) && amount > 0 && amount <= 100_000_000_000 ? Math.round(amount) : 0,
      });
    }
  }
  if (isRecord(value) && Array.isArray(value.packing)) {
    const taken = new Set(existingPacking.map(packingKey));
    for (const item of value.packing) {
      if (packing.length >= MAX_IMPORT_PACKING || !isRecord(item)) continue;
      const name = trimTo(item.name, 80);
      if (!name || !PACKING_CATEGORIES.includes(item.category as PackingCategory)) continue;
      const key = packingKey(name);
      if (!key || taken.has(key) || [...taken].some((seen) => seen.startsWith(key) || key.startsWith(seen))) continue;
      taken.add(key);
      const qty = Number(item.qty);
      packing.push({ name, category: item.category as PackingCategory, qty: Number.isInteger(qty) && qty >= 1 && qty <= 99 ? qty : 1 });
    }
  }
  return { itinerary, packing };
}

export const isImportReply = (value: unknown): value is { itinerary: unknown[]; packing: unknown[] } =>
  isRecord(value) && Array.isArray(value.itinerary) && Array.isArray(value.packing) && value.itinerary.length <= 200 && value.packing.length <= 100;
