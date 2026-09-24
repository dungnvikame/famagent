// One sentence → one purchase draft ("vừa mua 2 bịch Merries L 64 miếng 690k ở Shopee"). Rules only: amounts via
// parseVnd, pack/piece counts, merchant, relative dates and a loose match against the family's items. The draft is
// always shown on a confirmation card before anything is saved, so a wrong guess costs one correction, not bad data.
import { parseVnd } from "../money/parse.ts";
import { addDays, CATEGORY_LABELS, DEFAULT_UNIT, matchItem, normalizeText, type ItemCategory, type ShoppingItem } from "./items.ts";

export interface PurchaseDraft {
  /** Existing item this purchase restocks; undefined = a new item named `name`. */
  itemId?: string;
  name: string;
  category: ItemCategory;
  unit: string;
  packs: number;
  /** Units per pack; undefined when the sentence did not say and no item is known. */
  packSize?: number;
  brand?: string;
  amount?: number;
  merchant?: string;
  /** YYYY-MM-DD */
  purchasedOn: string;
  missing: Array<"amount" | "name" | "packSize">;
}

const MERCHANTS: Array<[RegExp, string]> = [
  [/shopee/, "Shopee"], [/lazada/, "Lazada"], [/tiki/, "Tiki"], [/tiktok/, "TikTok Shop"], [/con cung/, "Con Cưng"], [/bibo ?mart/, "Bibo Mart"],
  [/kids ?plaza/, "Kids Plaza"], [/bach hoa xanh|bhx/, "Bách Hóa Xanh"], [/winmart|vinmart/, "WinMart"], [/co\.?op ?(mart|food)?/, "Co.op"],
  [/aeon/, "AEON"], [/lotte/, "Lotte Mart"], [/circle ?k/, "Circle K"], [/guardian/, "Guardian"], [/sieu thi/, "Siêu thị"],
  // Folded "chợ" = "cho" (for): only a market when it follows "ở/tại/ngoài".
  [/\b(?:o|tai|ngoai) cho\b(?! (be|con|em|chong|vo|nha|minh|ba|me|ong)\b)/, "Chợ"],
];
const PACK_WORDS: Record<string, string> = { bich: "bịch", goi: "gói", hop: "hộp", lon: "lon", thung: "thùng", chai: "chai", hu: "hũ", tui: "túi", cuon: "cuộn", loc: "lốc", can: "can", tuyp: "tuýp", vi: "vỉ", lo: "lọ", set: "set", combo: "combo" };
const PIECE_WORDS: Record<string, string> = { mieng: "miếng", to: "tờ", cai: "cái", vien: "viên" };
export const CATEGORY_WORDS: Array<[RegExp, ItemCategory]> = [
  [/khan (giay )?uot/, "wipes"], [/\b(bim|ta dan|ta quan|ta)\b/, "diapers"], [/\b(bot an dam|chao|an dam|banh an dam|pure)\b/, "solids"],
  [/\bsua (bot|cong thuc|tuoi|chua)?|\b(meiji|similac|aptamil|enfa|nan|friso|morinaga|glico|vinamilk|nutifood|colosbaby)\b/, "milk"],
  [/sua tam|dau goi|kem ham|nuoc giat (xa )?(em be|cho be)|nuoc rua binh|phan rom|bong tam|tam be/, "hygiene"],
  [/nuoc giat|nuoc xa|nuoc rua bat|giay ve sinh|khan giay|nuoc lau|tui rac|kem danh rang|xa phong|nuoc rua tay/, "household"],
  [/\b(merries|huggies|bobby|pampers|moony|goon|molfix|genki|mamamy|yubest|unidry|rascal|babydry|caryn|kochi|takato|whito)\b/, "diapers"],
];
// Checked on the lower-cased original (with diacritics): folded "da" would also match "da" (skin), "can" would match the unit.
const word = (list: string) => new RegExp(String.raw`(?<![\p{L}\d])(?:${list})(?![\p{L}\d])`, "u");
const PAST = word("vừa|mới|đã|hôm qua|hôm nay|hôm kia|sáng nay|chiều nay|tối qua|trưa nay|lúc nãy|hồi nãy|rồi|xong");
export const NEED = word("nên|cần|muốn|tìm|gợi ý|so sánh|loại nào|mua gì|ở đâu|bao nhiêu|đặt hàng giúp|rẻ nhất|tốt nhất|định|tính|sắp|dự định|hay là|được không|có rẻ không|có nên|không nhỉ|giúp mình|giúp tôi|cho mình xem");
/** The same requests typed without diacritics ("can mua bim duoi 400k"); "can" alone is also the unit, so only "can mua". */
export const FOLDED_NEED = /\b(nen mua|can mua|muon mua|tim|goi y|so sanh|loai nao|mua gi|o dau|bao nhieu|dinh mua|tinh mua|sap mua|duoc khong|co nen|re nhat|tot nhat)\b|\b(duoi|toi da|khong qua|khoang)\s*\d/;
export const PRICE_LIMIT =/(?<![\p{L}\d])(?:dưới|tối đa|không quá|tầm|khoảng|max|trên|từ)\s*\d/u;
const AMOUNT = /(?<![\p{L}\d.,])(\d+(?:[.,]\d+)?\s?(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|m)\d?|\d{1,3}(?:[.,]\d{3})+\s?(?:đ|vnđ|vnd|d)?|\d{5,}\s?(?:đ|vnđ|vnd|d)?)(?![\p{L}\d])/giu;

/** Lower-cased, diacritics stripped, one output character per input character (so indexes map back). */
export const fold = (text: string) => [...text].map((char) => normalizeText(char)[0] ?? " ").join("");

export interface Span { start: number; end: number }
export const cut = (text: string, spans: Span[]) => { let out = ""; let cursor = 0; for (const span of [...spans].sort((a, b) => a.start - b.start)) { if (span.start >= cursor) { out += text.slice(cursor, span.start) + " "; cursor = span.end; } } return out + text.slice(cursor); };

/** True when the sentence reports a purchase already made (not a request to find or compare something). */
export function looksLikePurchaseLog(text: string): boolean {
  const lower = text.toLocaleLowerCase("vi");
  if (!/(?<![\p{L}\d])mua(?![\p{L}\d])/u.test(lower) || lower.includes("?") || NEED.test(lower) || PRICE_LIMIT.test(lower) || FOLDED_NEED.test(fold(text))) return false;
  // "mua lại Merries" asks the agent to reorder; "vừa mua lại 2 bịch 600k" reports a purchase.
  if (!findAmount(text)) return false;
  // Typed without diacritics: only unambiguous phrases ("da" alone could be "da" = skin).
  return PAST.test(lower) || /\b(vua mua|moi mua|da mua|hom qua|hom nay|hom kia|sang nay|toi qua)\b/.test(fold(text));
}

export function findAmount(text: string): { value: number; span: Span } | null {
  let found: { value: number; span: Span } | null = null;
  for (const match of text.matchAll(AMOUNT)) {
    const value = parseVnd(match[1].replace(/\s/g, "").replace(/nghin|ngan/i, "k"));
    if (value && value >= 1000) found = { value, span: { start: match.index, end: match.index + match[0].length } };
  }
  return found;
}

export function findDate(folded: string, today: string): { on: string; span?: Span } {
  const relative: Array<[RegExp, number]> = [[/\bhom kia\b/, -2], [/\bhom qua\b|\btoi qua\b/, -1], [/\bhom nay\b|\bsang nay\b|\bchieu nay\b/, 0]];
  for (const [pattern, delta] of relative) { const match = pattern.exec(folded); if (match) return { on: addDays(today, delta), span: { start: match.index, end: match.index + match[0].length } }; }
  const explicit = /\b(?:ngay\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(folded);
  if (explicit) {
    const [day, month] = [Number(explicit[1]), Number(explicit[2])];
    let year = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : Number(today.slice(0, 4));
    const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      if (!explicit[3] && iso(year) > today) year -= 1;
      return { on: iso(year), span: { start: explicit.index, end: explicit.index + explicit[0].length } };
    }
  }
  return { on: today };
}

/** "Ghi đã mua lại <món>" → last purchase of that item again (packs, pack price, merchant), dated today. */
export function reorderDraft(text: string, stock: Array<{ productName: string; itemId?: string; unit?: string; packSize?: number; lastPackPrice?: number; merchant?: string }>, today: string): PurchaseDraft | null {
  const match = /^ghi đã mua lại\s+(.+)$/iu.exec(text.trim());
  const line = match && stock.find((entry) => entry.itemId && entry.productName.toLocaleLowerCase("vi") === match[1].trim().toLocaleLowerCase("vi"));
  if (!line) return null;
  return { itemId: line.itemId, name: line.productName, category: "diapers", unit: line.unit ?? "miếng", packs: 1, packSize: line.packSize, amount: line.lastPackPrice, merchant: line.merchant, purchasedOn: today, missing: [] };
}

/** Parses a purchase sentence into a draft; `items` lets "mua bỉm Merries" restock the family's existing item. */
export function parsePurchase(text: string, items: ShoppingItem[], today: string): PurchaseDraft {
  const folded = fold(text);
  const spans: Span[] = [];
  const amount = findAmount(text);
  if (amount) spans.push(amount.span);
  const date = findDate(folded, today);
  if (date.span) spans.push(date.span);

  let merchant: string | undefined;
  for (const [pattern, name] of MERCHANTS) {
    const match = pattern.exec(folded);
    if (!match) continue;
    merchant = name;
    const before = /\b(o|tai|tren|qua)\s+$/.exec(folded.slice(0, match.index));
    spans.push({ start: before ? before.index : match.index, end: match.index + match[0].length });
    break;
  }
  if (!merchant) {
    const at = /\b(?:o|tai)\s+((?:[a-z0-9]+\s?){1,3})$/.exec(folded.replace(/[.,!]+$/, ""));
    if (at) { merchant = text.slice(at.index, at.index + at[0].length).replace(/^\S+\s+/, "").trim(); spans.push({ start: at.index, end: at.index + at[0].length }); }
  }

  let packs = 1; let packWord: string | undefined;
  const pack = new RegExp(`\\b(\\d{1,2})\\s*(${Object.keys(PACK_WORDS).join("|")})\\b`).exec(folded);
  if (pack) { packs = Math.min(50, Math.max(1, Number(pack[1]))); packWord = PACK_WORDS[pack[2]]; spans.push({ start: pack.index, end: pack.index + pack[0].length }); }
  let packSize: number | undefined; let pieceWord: string | undefined;
  const pieces = new RegExp(`\\b(\\d{1,4})\\s*(${Object.keys(PIECE_WORDS).join("|")})\\b`).exec(folded);
  if (pieces) { packSize = Number(pieces[1]); pieceWord = PIECE_WORDS[pieces[2]]; spans.push({ start: pieces.index, end: pieces.index + pieces[0].length }); }
  // Diaper packs are named by size + count: "L64", "XL 44".
  const sized = /\b(nb|s|m|l|xl|xxl|xxxl)\s?(\d{2,3})\b/.exec(folded);
  if (sized && !packSize) { packSize = Number(sized[2]); pieceWord = "miếng"; spans.push({ start: sized.index + sized[1].length, end: sized.index + sized[0].length }); }

  const rest = fold(cut(text, spans));
  let name = cut(text, spans);
  // Drop filler words using the folded copy to find them (same indexes as `name`).
  const filler = /\b(toi|minh|vua|moi|da|mua|duoc|roi|xong|het|cho be|cho con|nha minh|sang nay|chieu nay|voi|gia|tong|la|them)\b/g;
  name = [...rest.matchAll(filler)].reverse().reduce((acc, match) => acc.slice(0, match.index) + " ".repeat(match[0].length) + acc.slice(match.index + match[0].length), name);
  name = name.replace(/(?<!\d)[,.;:!]+|[,.;:!]+(?!\d)/g, " ").replace(/\s+/g, " ").trim();
  name = name ? name[0].toLocaleUpperCase("vi") + name.slice(1) : "";

  const existing = matchItem(name || text, items.filter((item) => item.status !== "outgrown"));
  const guessed = CATEGORY_WORDS.find(([pattern]) => pattern.test(folded))?.[1] ?? (pieceWord === "miếng" ? "diapers" : "other");
  const category = existing?.category ?? guessed;
  const unit = existing?.unit ?? pieceWord ?? (packWord && !["diapers", "wipes"].includes(category) ? packWord : DEFAULT_UNIT[category]);
  const size = packSize ?? existing?.packSize ?? (!pieceWord && !["diapers", "wipes"].includes(category) ? 1 : undefined);
  const finalName = existing?.name ?? (name || CATEGORY_LABELS[category]);
  const missing: PurchaseDraft["missing"] = [];
  if (!amount) missing.push("amount");
  if (!name && !existing) missing.push("name");
  if (!size) missing.push("packSize");
  return { itemId: existing?.id, name: finalName, category, unit, packs, packSize: size, brand: existing?.brand, amount: amount?.value, merchant: merchant ?? existing?.merchant, purchasedOn: date.on, missing };
}
