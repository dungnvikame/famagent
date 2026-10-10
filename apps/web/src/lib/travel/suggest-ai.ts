// AI second pass for the packing checklist (plan 261010-1335 Đợt 5): the rule template covers the common items;
// the model adds destination-specific ones. Only trip facts and item names are sent — children appear as
// "bé N tháng/tuổi", never by name. Code validates every answer; the family confirms before anything is added.
import type { JsonSchema } from "../ai/llm/index.ts";
import { packingKey, type PackingSuggestion } from "./packing-template.ts";
import { DEST_TYPE_LABELS, DEST_TYPES, PACKING_CATEGORIES, PACKING_CATEGORY_LABELS, type DestType, type PackingCategory } from "./types.ts";

export const MAX_AI_SUGGESTIONS = 15;
const MAX_EXISTING = 120;

export interface SuggestRequest {
  destination: string;
  destType: DestType;
  nights: number;
  /** "bé 18 tháng", "bé 4 tuổi" — no names. */
  childAges: string[];
  adults: number;
  /** Names already on the checklist (template + manual), so the model only adds what is missing. */
  existing: string[];
}

export const SUGGEST_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "category"], properties: { name: { type: "string" }, category: { type: "string", enum: [...PACKING_CATEGORIES] }, qty: { type: "integer" } } } } },
};

export function suggestSystem(request: SuggestRequest): string {
  return `Bạn giúp một gia đình Việt Nam soạn đồ cho chuyến đi: ${request.destination} (${DEST_TYPE_LABELS[request.destType].label.toLowerCase()}), ${request.nights} đêm, ${request.adults} người lớn${request.childAges.length ? ` và ${request.childAges.join(", ")}` : ""}.
Checklist đã có: ${request.existing.length ? request.existing.join(" | ") : "(trống)"}.
Gợi ý TỐI ĐA ${MAX_AI_SUGGESTIONS} món CHƯA có trong checklist, thiết thực và đặc thù cho điểm đến/mùa/độ tuổi (đặc sản nên thử không tính — chỉ đồ cần mang hoặc chuẩn bị). Không lặp lại món đã có dưới tên khác. Tên món ngắn gọn tiếng Việt (≤60 ký tự).
category đúng một trong: ${PACKING_CATEGORIES.map((category) => `${category} (${PACKING_CATEGORY_LABELS[category]})`).join(", ")}. qty là số lượng nên mang (1–99, bỏ qua nếu là 1).`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Request body from the browser → a clean request, or null. */
export function validSuggestRequest(input: unknown): SuggestRequest | null {
  if (!isRecord(input)) return null;
  const destination = typeof input.destination === "string" && input.destination.trim() && input.destination.length <= 120 ? input.destination.trim() : null;
  const destType = DEST_TYPES.includes(input.destType as DestType) ? input.destType as DestType : null;
  const nights = Number(input.nights);
  const adults = Number(input.adults);
  const ages = Array.isArray(input.childAges) && input.childAges.length <= 10 && input.childAges.every((age) => typeof age === "string" && /^bé \d{1,3} (tháng|tuổi)$/.test(age)) ? input.childAges as string[] : null;
  const existing = Array.isArray(input.existing) && input.existing.length <= MAX_EXISTING && input.existing.every((name) => typeof name === "string" && name.trim() && name.length <= 100) ? (input.existing as string[]).map((name) => name.trim()) : null;
  if (!destination || !destType || !ages || !existing || !Number.isInteger(nights) || nights < 0 || nights > 60 || !Number.isInteger(adults) || adults < 1 || adults > 15) return null;
  return { destination, destType, nights, childAges: ages, adults, existing };
}

/** Model reply → validated suggestions: whitelisted category, bounded qty, deduped against the checklist and itself. */
export function cleanSuggestions(value: unknown, request: SuggestRequest): PackingSuggestion[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  const taken = new Set(request.existing.map(packingKey));
  const out: PackingSuggestion[] = [];
  for (const item of value.items) {
    if (out.length >= MAX_AI_SUGGESTIONS) break;
    if (!isRecord(item) || typeof item.name !== "string" || !PACKING_CATEGORIES.includes(item.category as PackingCategory)) continue;
    const name = item.name.trim().slice(0, 80);
    const key = packingKey(name);
    if (!name || !key || taken.has(key) || [...taken].some((seen) => seen.startsWith(key) || key.startsWith(seen))) continue;
    const qty = Number(item.qty);
    taken.add(key);
    out.push({ name, category: item.category as PackingCategory, qty: Number.isInteger(qty) && qty >= 1 && qty <= 99 ? qty : 1 });
  }
  return out;
}

export const isSuggestReply = (value: unknown): value is { items: unknown[] } => isRecord(value) && Array.isArray(value.items) && value.items.length <= 60;
