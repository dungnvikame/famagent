// Rule-based extraction for Vietnamese onboarding answers. Used when AI is off,
// not consented, rate-limited or failing — and merged under AI results (P1 carry-over).
import type { Sensitivity } from "../../experience/types.ts";
import { emptyExtraction, type Extraction } from "./extraction.ts";

const NUMBER_WORDS: Record<string, number> = { một: 1, hai: 2, ba: 3, bốn: 4, năm: 5 };
const toNumber = (value: string) => NUMBER_WORDS[value.toLocaleLowerCase("vi")] ?? Number(value);
const NUM = "(\\d{1,2}|một|hai|ba|bốn|năm)";
/** Whole-word match that works for Vietnamese letters (\b is ASCII-only in JS). */
const word = (alternatives: string) => new RegExp(`(?<![\\p{L}])(?:${alternatives})(?![\\p{L}])`, "u");
const HEDGE = word("chắc|khoảng|tầm|hình như|có lẽ|cỡ chừng|áng chừng|chừng");
// "chứ" only as a closing particle ("11kg chứ"), and "không phải X mà Y" — not "không phải lo".
const CORRECTION = new RegExp(`${word("nhầm|sửa lại|đổi lại|thực ra").source}|chứ[\\s.!?]*$|không phải\\s+\\S+.*\\smà\\s`, "u");
/** Lookahead end for brand lists: punctuation, end, or a following clause word. */
const STOP = (words: string, punctuation = "[.;]") => `(?=\\s*(?:${punctuation}|$|\\s+(?:${words})(?![\\p{L}])))`;

/** VND amount from "400k", "1,2 triệu", "350.000đ", "dưới 400". */
export function parseVnd(message: string): number | null {
  for (const match of message.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d)?)\s*(k|nghìn|ngàn|triệu|tr|đ|vnd|vnđ)?(?![\p{L}\d])/giu)) {
    const raw = match[1]; const unit = (match[2] ?? "").toLocaleLowerCase("vi");
    const base = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw) ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
    const amount = /^(triệu|tr)$/.test(unit) ? base * 1_000_000 : /^(k|nghìn|ngàn)$/.test(unit) ? base * 1000 : !unit && base >= 50 && base < 10_000 ? base * 1000 : base;
    if (amount >= 50_000 && amount <= 100_000_000 && (unit || /(dưới|tối đa|ngân sách|tầm|khoảng|giá)\s*$/i.test(message.slice(0, match.index)))) return Math.round(amount);
  }
  return null;
}

/** Brand-like names after a cue, split on commas/"và", trimmed to 40 chars. */
function brandsAfter(message: string, cue: RegExp): string[] | null {
  const match = message.match(cue);
  if (!match?.[1]) return null;
  const items = match[1].split(/,|(?<![\p{L}])(?:và|hoặc)(?![\p{L}])|\//u).map((item) => item.trim().replace(/[.!?]+$/, "").slice(0, 40)).filter((item) => item && item.length <= 40 && /^[\p{L}\d][\p{L}\d .&'-]*$/u.test(item));
  return items.length ? [...new Set(items)].slice(0, 10) : null;
}

function monthsSince(month: number, year: number, now: Date): number | null {
  const months = (now.getFullYear() - year) * 12 + now.getMonth() + 1 - month;
  return month >= 1 && month <= 12 && months >= 0 && months <= 72 ? months : null;
}

export function extractRules(message: string, now = new Date()): Extraction {
  const text = message.trim();
  const lower = text.toLocaleLowerCase("vi");
  const result = emptyExtraction();

  const weight = text.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ký|kí|cân)(?![\p{L}])/iu);
  if (weight) result.weightKg = Number(weight[1].replace(",", "."));
  // The size letter must end the word: "size mình không nhớ" must not read as size M.
  const size = text.match(/(?:size|cỡ|sz)\s*(NB|S|M|L|XL|XXL)(?![\p{L}\d])/iu) ?? text.match(/(?<![\p{L}\d])(NB|XXL|XL)(?![\p{L}\d])/u);
  if (size) result.diaperSize = size[1].toUpperCase();
  // Exclude only dates ("14 tháng 3/2025"), not a following measurement ("14 tháng 10kg").
  const age = lower.match(/(\d{1,2})\s*(?:tháng|th)\s*tuổi|(\d{1,2})\s*tháng(?!\s*\d{1,2}\s*[/.-]\s*\d)/);
  if (age) result.ageMonths = Number(age[1] ?? age[2]);
  const years = lower.match(/(\d)\s*tuổi/);
  if (!age && years) result.ageMonths = Number(years[1]) * 12;
  const fullDate = text.match(/sinh(?:\s+ngày)?\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i);
  if (fullDate) result.birthDate = `${fullDate[3]}-${fullDate[2].padStart(2, "0")}-${fullDate[1].padStart(2, "0")}`;
  const monthYear = !fullDate ? lower.match(/sinh(?:\s+(?:vào\s+)?tháng)?\s+(\d{1,2})[/.-](\d{4})/) : null;
  // Month precision only: derive age instead of inventing a day of birth.
  if (monthYear && result.ageMonths === null) result.ageMonths = monthsSince(Number(monthYear[1]), Number(monthYear[2]), now);

  const name = text.match(/(?:[Tt]ên(?:\s+(?:bé|con|cháu))?(?:\s+là)?|[Gg]ọi\s+là|[Bb]é|[Cc]on)\s+([\p{Lu}][\p{L}]{1,23})/u)?.[1];
  if (name && !/^(Dưới|Nặng|Được|Đang|Mới|Hay|Hơi)$/u.test(name)) result.childName = name;

  if (/vợ chồng|hai vợ chồng|bố mẹ/.test(lower)) result.adultsCount = 2;
  const adults = lower.match(new RegExp(`${NUM}\\s*(?:người lớn|người trưởng thành)`));
  if (adults) result.adultsCount = toNumber(adults[1]);
  // "ba" also means "dad", so child counts only accept digits, "một" and "hai".
  const kids = lower.match(/(?<![\d\p{L}])(\d|một|hai)\s*(?:bé|con|cháu)(?![\p{L}])/u);
  if (kids) result.childrenCount = toNumber(kids[1]);
  // "nhà 4 người, 2 bé" → 2 adults; without a child count the split is unknown, so don't guess.
  const household = lower.match(new RegExp(`(?:nhà|gia đình)\\s*(?:mình|em|tôi)?\\s*(?:có\\s*)?${NUM}\\s*người(?!\\s*lớn)`));
  if (household && result.adultsCount === null && result.childrenCount !== null && toNumber(household[1]) > result.childrenCount) result.adultsCount = toNumber(household[1]) - result.childrenCount;

  const sensitivities = new Set<Sensitivity>();
  if (/da\s*(?:hơi\s*|rất\s*)?nhạy cảm|dễ kích ứng|kích ứng/.test(lower)) sensitivities.add("sensitive_skin");
  if (/hăm|mẩn đỏ/.test(lower)) sensitivities.add("rash_prone");
  if (/không (?:mùi|hương liệu)|không thích mùi|mùi nồng/.test(lower)) sensitivities.add("fragrance_free");
  if (sensitivities.size) result.sensitivities = [...sensitivities];
  result.currentBrand = brandsAfter(text, new RegExp(`(?:đang dùng|hiện dùng|vẫn dùng|quen dùng)\\s+(?:bỉm\\s+|loại\\s+|hãng\\s+)?([^,.;]+?)${STOP("và|nhưng|thích|tránh|không", "[,.;]")}`, "iu"))?.[0] ?? null;
  // Brand lists require a capitalised name so "thích loại mỏng" is not read as a brand.
  result.preferredBrands = brandsAfter(text, new RegExp(`(?:[Tt]hích|[Ưư]u tiên hãng|[Tt]in dùng)\\s+(?:dùng\\s+)?(?:bỉm\\s+|hãng\\s+)?(\\p{Lu}[^.;]*?)${STOP("nhưng|tránh|không")}`, "u"));
  result.dislikedBrands = brandsAfter(text, new RegExp(`(?:[Tt]ránh|[Kk]hông (?:dùng|thích|hợp)|bị kích ứng với)\\s+(?:bỉm\\s+|hãng\\s+)?(\\p{Lu}[^.;]*?)${STOP("nhưng|thích")}`, "u"));
  const avoided = brandsAfter(lower, /(?:tránh|không muốn có|không dùng)\s+(?:thành phần\s+)?((?:hương liệu|paraben|cồn|chlorine|clo)(?:[^.;]*))/);
  if (avoided) result.avoidedIngredients = avoided;

  if (/rẻ nhất|giá thấp nhất|tiết kiệm nhất/.test(lower)) result.pricePreference = "budget";
  else if (/giá trị tốt|đáng tiền|giá\/miếng|giá mỗi miếng/.test(lower)) result.pricePreference = "value";
  else if (/cao cấp|premium|loại tốt nhất/.test(lower)) result.pricePreference = "premium";
  else if (/cân bằng|vừa phải|hợp lý/.test(lower)) result.pricePreference = "balanced";
  result.maxBudget = parseVnd(text);
  result.mainConcern = /tràn|rò rỉ|thấm ngược/.test(lower) ? "leak" : /ban đêm|ngủ đêm|dùng đêm/.test(lower) ? "night" : /mỏng|mềm|thoáng/.test(lower) ? "soft" : sensitivities.has("sensitive_skin") && /ưu tiên/.test(lower) ? "sensitive" : /tiết kiệm|giá tốt/.test(lower) ? "value" : null;
  result.deliveryPreference = /giao nhanh|nhanh nhất|trong ngày|hỏa tốc/.test(lower) ? "fastest" : /phí (?:ship|giao) (?:rẻ|thấp)|miễn phí (?:ship|giao)|freeship/.test(lower) ? "cheapest" : null;
  result.washingMachine = /cửa trước|cửa ngang|lồng ngang/.test(lower) ? "front" : /cửa trên|lồng đứng/.test(lower) ? "top" : /không có máy giặt|giặt tay|không dùng máy/.test(lower) ? "none" : null;

  // A hedge just before a child's measurement makes it tentative: confirm before saving.
  // The hedge must sit in the same clause: "chắc tầm 10kg, size L" hedges the weight, not the size.
  const hedged = (index: number | undefined) => index !== undefined && HEDGE.test(lower.slice(Math.max(0, index - 16), index).split(/[,;.]/).at(-1) ?? "");
  result.uncertainFields = [
    ...(weight && hedged(weight.index) ? ["weightKg"] : []),
    ...(size && hedged(size.index) ? ["diaperSize"] : []),
    ...(age && hedged(age.index) ? ["ageMonths"] : []),
  ];
  result.skip = /bỏ qua|không nhớ|để sau|chưa biết|không rõ|skip|thôi khỏi/.test(lower);
  result.nothing = /^(?:không|ko|k|chưa|hông)(?:\s+(?:có|ạ|nha|nhé|luôn))?[\s.!]*$|không có gì|bình thường|không đặc biệt|không vấn đề/.test(lower);
  result.confirm = /^(?:đúng|đúng rồi|ừ|uh|ờ|ok|oke|okay|chuẩn|phải|đồng ý|xác nhận|chính xác|yes)(?:\s+(?:rồi|ạ|nha|nhé|luôn))?[\s.!]*$/.test(lower);
  result.correction = CORRECTION.test(lower);
  return result;
}
