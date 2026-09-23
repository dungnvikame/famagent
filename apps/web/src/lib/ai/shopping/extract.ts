// Shopping-message extraction (spec v1 §7): one flat contract for the LLM and the rule parser.
// Values are raw; context-merger validates and resolves them against the family profile.
import { chatJson, type JsonSchema } from "../llm/index.ts";
import { parseVnd } from "../onboarding/extract-rules.ts";
import { INTENT_TYPES, PRIORITIES, type IntentType, type Priority } from "../../experience/types.ts";

export interface ShoppingExtraction {
  intentType: IntentType | null;
  categoryId: "diapers" | "unsupported" | null;
  childName: string | null;
  weightKg: number | null;
  sizeLabel: string | null;
  maxTotalPriceVnd: number | null;
  maxUnitPriceVnd: number | null;
  nightUse: boolean | null;
  leakProtection: boolean | null;
  sensitiveSkin: boolean | null;
  priority: Priority | null;
  /** "bỏ giới hạn giá" — drop any price ceiling carried from profile or earlier turns. */
  removePriceLimit: boolean;
}

export const emptyShoppingExtraction = (): ShoppingExtraction => ({
  intentType: null, categoryId: null, childName: null, weightKg: null, sizeLabel: null, maxTotalPriceVnd: null, maxUnitPriceVnd: null,
  nightUse: null, leakProtection: null, sensitiveSkin: null, priority: null, removePriceLimit: false,
});

const word = (alternatives: string) => new RegExp(`(?<![\\p{L}])(?:${alternatives})(?![\\p{L}])`, "u");

/** "7k/miếng", "dưới 6.500đ mỗi miếng" → unit price ceiling in VND. */
function unitPrice(lower: string): { value: number; text: string } | null {
  const match = lower.match(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|đ|vnd)?\s*(?:\/\s*1?|mỗi|một)\s*miếng/u);
  if (!match) return null;
  const base = Number(match[1].replace(/\.(?=\d{3}$)/, "").replace(",", "."));
  const value = /^(k|nghìn|ngàn)$/.test(match[2] ?? "") || base < 100 ? base * 1000 : base;
  return value >= 500 && value <= 50_000 ? { value: Math.round(value), text: match[0] } : null;
}

/** "giá bao nhiêu cũng được" = any price is fine: no ceiling, and not a price-check question. */
const ANY_PRICE = /giá\s+(?:bao nhiêu|nào|gì)\s+cũng\s+được/;

export function extractShoppingRules(message: string): ShoppingExtraction {
  const text = message.trim();
  const lower = text.toLocaleLowerCase("vi");
  // Typing without diacritics is common on phones: "tim bim ban dem". Folded cues apply only when the
  // message itself has no diacritics ("bạn đem" / "dùng đệm" must not fold into "ban dem" / "dung dem").
  const folded = lower.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
  const plain = folded === lower;
  const result = emptyShoppingExtraction();
  result.categoryId = /bỉm|tã|diaper/.test(lower) || (plain && word("bim|ta dan|ta quan").test(folded) && !/bim\s*bim/.test(folded)) ? "diapers" : /khăn|giặt|rửa|giấy|túi rác|sữa|thuốc/.test(lower) ? "unsupported" : null;
  result.intentType = /so sánh|khác nhau/.test(lower) ? "compare"
    : /mua lại|như lần trước|loại lần trước/.test(lower) ? "reorder"
    : /sắp hết|còn (?:bao nhiêu|mấy)|hết chưa/.test(lower) ? "check_replenishment"
    : /giỏ (?:hàng )?tháng|tháng này cần mua/.test(lower) ? "monthly_basket"
    : /giá .*(?:bao nhiêu|hiện tại|đang giảm)|có giảm giá/.test(lower) && !ANY_PRICE.test(lower) ? "price_check"
    : result.categoryId ? "discover" : null;
  // Several weights ("bỉm 5kg ... cho bé 10kg"): prefer one shortly after "bé/con/nặng/được" (a heuristic;
  // the optional name slot is loose under the i flag), else the first.
  const weights = [...text.matchAll(plain ? /(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ky|ki|ký|kí|cân)(?![\p{L}])/giu : /(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ký|kí|cân)(?![\p{L}])/giu)];
  const weight = weights.find((match) => /(?:bé|con|nặng|được|be|nang|duoc)\s*(?:\p{Lu}\p{L}*\s*)?(?:(?:nặng|nang)\s*)?$/iu.test(text.slice(Math.max(0, match.index! - 20), match.index))) ?? weights[0];
  if (weight) result.weightKg = Number(weight[1].replace(",", "."));
  const size = text.match(/(?:size|cỡ|sz)\s*(NB|S|M|L|XL|XXL)(?![\p{L}\d])/iu) ?? text.match(/(?<![\p{L}\d])(NB|XXL|XL)(?![\p{L}\d])/u);
  if (size) result.sizeLabel = size[1].toUpperCase();
  const unit = unitPrice(lower);
  if (unit) result.maxUnitPriceVnd = unit.value;
  // A unit-price phrase must not also be read as a pack price ceiling.
  result.maxTotalPriceVnd = parseVnd(unit ? lower.replace(unit.text, " ") : text);
  if (!unit && result.maxTotalPriceVnd === null) {
    // Domain rule instead of a question: no diaper pack costs under 20k, so "dưới 8k" is a per-piece ceiling.
    const small = lower.match(/(?:dưới|tối đa|không quá|tầm|khoảng)\s*(\d{1,2}(?:[.,]\d)?)\s*(k|nghìn|ngàn)(?![\p{L}])/u);
    if (small) { const value = Math.round(Number(small[1].replace(",", ".")) * 1000); if (value >= 1000 && value <= 20_000) result.maxUnitPriceVnd = value; }
  }
  // "giá bao nhiêu cũng được" drops carried-over ceilings, but never a cap stated in the same message.
  result.removePriceLimit = /bỏ (?:giới hạn )?giá|không giới hạn giá/.test(lower) || (ANY_PRICE.test(lower) && result.maxTotalPriceVnd === null && result.maxUnitPriceVnd === null);
  if (result.removePriceLimit) result.maxTotalPriceVnd = null;
  result.nightUse = /ban đêm|dùng đêm|ngủ đêm|qua đêm/.test(lower) || /(?:bỉm|tã)\s+(?:dùng\s+)?đêm(?!\s+qua)/.test(lower) || (plain && word("ban dem|dung dem|ngu dem|qua dem|bim dem").test(folded)) ? true : null;
  result.leakProtection = /chống tràn|hay tràn|hạn chế tràn|bị tràn/.test(lower) ? true : null;
  result.sensitiveSkin = /da nhạy cảm|kích ứng|dễ hăm/.test(lower) ? true : null;
  result.priority = /rẻ nhất|giá thấp nhất/.test(lower) ? "lowest_cost"
    : /tiết kiệm|đáng tiền|giá tốt|giá mỗi miếng|giá\/miếng/.test(lower) ? "best_value"
    : /chất lượng|cao cấp|loại tốt/.test(lower) ? "quality"
    : /giao nhanh|hỏa tốc|trong ngày/.test(lower) ? "fast_delivery" : null;
  const name = text.match(/(?:[Cc]ho\s+)?(?:[Bb]é|[Cc]on)\s+(\p{Lu}\p{L}{1,23})/u)?.[1] ?? text.match(/[Cc]ho\s+(\p{Lu}\p{L}{1,23})/u)?.[1];
  if (name && !word("Dưới|Nặng|Được|Đang|Mới|Hay|Hơi|Tôi|Mình|Em").test(name)) result.childName = name;
  return result;
}

/**
 * Brands from the catalog mentioned in the message: after a negation cue ("không dùng", "tránh",
 * "trừ") they are exclusions (always hard filters, spec v1 §7), otherwise preferences.
 */
const NEGATION_BEFORE = /(?:không\s+(?:dùng|lấy|thích|muốn|mua|chọn|hợp)|đừng(?:\s+(?:lấy|dùng|mua|chọn))?|tránh|trừ|ngoại trừ|bỏ|ghét|kiêng|bị\s+(?:hăm|kích ứng|dị ứng)\s+(?:với|vì|do))\s+(?:[\p{L}]+\s+){0,2}$/u;
const NEGATION_AFTER = /^\s*(?:thì\s+)?(?:không\s+(?:hợp|tốt|dùng được|ổn)|bị\s+(?:tràn|hăm|kích ứng|dị ứng)|làm\s+bé\s+(?:hăm|kích ứng)|dở)/u;
// Only explicit override phrases; "bé vẫn dùng X nhưng hay tràn" describes, it does not lift an exclusion.
const LIFT_BEFORE = /(?:bỏ\s+tránh|thôi\s+tránh|vẫn\s+tìm)\s+(?:[\p{L}]+\s+){0,2}$/u;

export function brandMentions(message: string, catalogBrands: string[]): { preferred: string[]; excluded: string[]; lifted: string[] } {
  const lower = message.toLocaleLowerCase("vi");
  const preferred: string[] = []; const excluded: string[] = []; const lifted: string[] = [];
  for (const brand of [...new Set(catalogBrands)]) {
    const needle = brand.toLocaleLowerCase("vi").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<![\\p{L}])${needle}(?![\\p{L}])`, "u").exec(lower);
    if (!match) continue;
    const before = lower.slice(Math.max(0, match.index - 32), match.index);
    const after = lower.slice(match.index + match[0].length, match.index + match[0].length + 32);
    // Order matters: "bỏ tránh X" lifts; any negation before/after excludes; only then is it a preference.
    if (LIFT_BEFORE.test(before)) lifted.push(brand);
    else if (NEGATION_BEFORE.test(before) || NEGATION_AFTER.test(after)) excluded.push(brand);
    else preferred.push(brand);
  }
  return { preferred, excluded, lifted };
}

const nullable = (type: string) => ({ type: [type, "null"] });
const schema: JsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    intentType: { type: ["string", "null"], enum: [...INTENT_TYPES, null] }, categoryId: { type: ["string", "null"], enum: ["diapers", "unsupported", null] },
    childName: nullable("string"), weightKg: nullable("number"), sizeLabel: { type: ["string", "null"], enum: ["NB", "S", "M", "L", "XL", "XXL", null] },
    maxTotalPriceVnd: nullable("integer"), maxUnitPriceVnd: nullable("integer"), nightUse: nullable("boolean"), leakProtection: nullable("boolean"),
    sensitiveSkin: nullable("boolean"), priority: { type: ["string", "null"], enum: [...PRIORITIES, null] }, removePriceLimit: { type: "boolean" },
  },
  required: ["intentType", "categoryId", "childName", "weightKg", "sizeLabel", "maxTotalPriceVnd", "maxUnitPriceVnd", "nightUse", "leakProtection", "sensitiveSkin", "priority", "removePriceLimit"],
};

const SYSTEM = [
  "Bạn là Intent parser cho trợ lý mua sắm gia đình tại Việt Nam. Chỉ trích xuất yêu cầu trong tin nhắn cuối; không gợi ý sản phẩm; không đoán thông tin trẻ, giá hay thương hiệu. Trường không có để null.",
  "intentType: discover (tìm mới), compare (so sánh), reorder (mua lại), check_replenishment (sắp hết chưa), monthly_basket (giỏ tháng), price_check (hỏi giá), unknown. Danh mục đang hỗ trợ: diapers (bỉm/tã); danh mục khác là unsupported.",
  "Tiền đổi sang VND. maxTotalPriceVnd là giá gói; maxUnitPriceVnd chỉ khi nói rõ giá mỗi miếng. removePriceLimit=true khi người dùng muốn bỏ giới hạn giá. Tên bé có thể là [BE_n]; giữ nguyên.",
].join("\n");

/** LLM extraction merged over rules: AI wins only on non-null values (all-null AI → rules, P1 carry-over). */
export async function extractShopping(message: string, allowAi: boolean, maskedMessage = message, chat = chatJson): Promise<{ extraction: ShoppingExtraction; mode: "ai" | "rules" }> {
  const rules = extractShoppingRules(message);
  const ai = allowAi ? (await chat<ShoppingExtraction>({ name: "shopping_intent", system: SYSTEM, messages: [{ role: "user", content: maskedMessage }], schema }))?.data ?? null : null;
  const useful = ai && Object.entries(ai).some(([key, value]) => key !== "childName" && value !== null && value !== false);
  if (!ai || !useful) return { extraction: rules, mode: "rules" };
  const merged = emptyShoppingExtraction();
  for (const key of Object.keys(merged) as (keyof ShoppingExtraction)[]) {
    (merged as unknown as Record<string, unknown>)[key] = typeof ai[key] === "boolean" ? ai[key] || rules[key] : ai[key] ?? rules[key];
  }
  // Names from the model are placeholders or unverified; only the rules' capitalised name is trusted.
  merged.childName = rules.childName;
  return { extraction: merged, mode: "ai" };
}
