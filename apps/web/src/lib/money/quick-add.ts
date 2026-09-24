import { parseVnd } from "./parse.ts";
import { DEFAULT_CATEGORIES, SAVING_CATEGORIES, type MoneyCategory, type MoneyKind, type MoneyTransaction } from "./types.ts";

/**
 * "Thêm nhanh bằng Trợ lý": a pasted list (or lines read from a photo) → ledger drafts the family reviews before
 * anything is written. Rules-first: the family's own corrections, then its own categories, then keyword rules.
 * Nothing here guesses silently — a weak guess is marked `unsure`, a likely duplicate starts unselected.
 */

export interface QuickDraft {
  key: string;
  occurredOn: string;
  content: string;
  kind: MoneyKind;
  category: string;
  /** Category the rules picked; a different final choice is remembered for next time. */
  autoCategory: string;
  /** > 0, except saving withdrawals (< 0) as in the ledger. */
  amount: number;
  forChild: boolean;
  unsure: boolean;
  /** Category worth creating for this line (e.g. "Đi lại") when the family has none that fits. */
  suggestNew?: string;
  /** Why the date may be off ("ngày theo dòng trên", "không ghi ngày"). */
  dateNote?: string;
  /** Existing ledger entry this line probably repeats. */
  dupeOf?: string;
  selected: boolean;
}

export interface QuickContext {
  /** YYYY-MM-DD */
  today: string;
  categories: MoneyCategory[];
  memory?: Record<string, string>;
  /** Entries already in the ledger (for duplicates and "same as last time" categories). */
  existing: MoneyTransaction[];
}

/** One line read from a photo by the vision model. */
export interface ImageLine { date: string | null; content: string; amount: number; direction: "in" | "out" }

/** Lowercase, no Vietnamese marks, single spaces: "Cà phê  Highlands" → "ca phe highlands". */
export const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** Memory key: the first two words without numbers ("Đổ xăng xe máy 80k" → "do xang"). */
export const memoryKey = (content: string) => normalize(content).split(" ").filter((word) => word && !/\d/.test(word)).slice(0, 2).join(" ");

type Rule = { test: RegExp; category: string; child?: boolean; fallback?: string };
// Order matters: child items before shopping sites ("bỉm shopee" is for the child), bills before food.
const EXPENSE_RULES: Rule[] = [
  { test: /\b(bim|ta giay|ta dan|ta quan|sua bot|sua cong thuc|do choi|quan ao be|do so sinh|khan uot)\b/, category: "Con", child: true },
  { test: /\b(hoc phi|mam non|hoc them|nha tre|tien hoc)\b/, category: "Học tập", child: true },
  { test: /\b(sach|vo viet|but|hoc online|khoa hoc)\b/, category: "Học tập" },
  { test: /\b(tien dien|hoa don dien|dien t\d{1,2}|dien thang|evn)\b|^dien\b(?! thoai| may)/, category: "Tiền điện" },
  { test: /\b(tien nuoc|hoa don nuoc|nuoc t\d{1,2}|nuoc thang)\b/, category: "Tiền nước" },
  { test: /\btra gop\b/, category: "Tiền trả góp" },
  { test: /\b(the tin dung|tra the|sao ke the)\b/, category: "Tiền thẻ tín dụng" },
  { test: /\btra no\b/, category: "Tiền trả nợ" },
  { test: /\b(thuoc|kham|benh vien|nha khoa|xet nghiem|vitamin|tiem)\b/, category: "Khám, thuốc" },
  { test: /\b(dam cuoi|an cuoi|mung cuoi|phong bi|dam hieu|vieng|dam gio|thoi noi|day thang|mung tho)\b/, category: "Hiếu hỉ" },
  { test: /\b(bieu|bo me|ong ba|tien nha|thue nha|tien phong)\b/, category: "Gia đình" },
  { test: /\b(du lich|khach san|ve may bay|homestay|resort|tour|booking|agoda)\b/, category: "Du lịch" },
  { test: /\b(xang|grab bike|grabbike|grab car|be car|xanh sm|taxi|gui xe|ve xe|sua xe|rua xe|thay dau|cau duong|vetc|epass)\b|^grab\b/, category: "Đi lại", fallback: "Tiêu dùng" },
  { test: /\b(an sang|an trua|an toi|an vat|an dem|cafe|ca phe|cf|tra sua|tra da|bun|pho|com|banh mi|di cho|nhau|lau|nuong|highlands|starbucks|phuc long|katinat|grabfood|shopeefood|baemin|do an|rau|thit|trai cay|hoa qua|nuoc mia|kem|pizza|kfc|lotteria|bach hoa xanh|winmart)\b/, category: "Ăn uống" },
  { test: /\b(phim|cgv|lotte cinema|karaoke|game|netflix|spotify|youtube|vui choi|cong vien)\b/, category: "Giải trí" },
  { test: /\b(internet|wifi|fpt|viettel|vnpt|dien thoai|cuoc|nap the|gas|xa phong|bot giat|nuoc rua|giay ve sinh)\b/, category: "Tiêu dùng" },
  { test: /\b(shopee|lazada|tiki|tiktok|quan ao|giay dep|my pham|son|nuoc hoa|do gia dung|dien may)\b/, category: "Mua sắm" },
  { test: /\b(dau tu|chung khoan|co phieu|mua vang|crypto|quy mo)\b/, category: "Chi phí đầu tư" },
  { test: /\bcho vay\b/, category: "Tiền cho vay" },
];
const INCOME_RULES: Rule[] = [
  { test: /\bluong\b/, category: "Lương" },
  { test: /\b(thuong|bonus)\b/, category: "Thưởng" },
  { test: /\b(co tuc|lai tiet kiem|lai ngan hang|ban co phieu|loi nhuan)\b/, category: "Đầu tư" },
  { test: /\b(freelance|du an|lam them|job ngoai)\b/, category: "Dự án ngoài" },
  { test: /\b(bo me cho|ong ba cho|duoc cho|me cho|bo cho|ho tro)\b/, category: "Gia đình hỗ trợ" },
  { test: /\b(tra no|tra lai tien)\b/, category: "Tiền trả nợ nhận về" },
];
const INCOME_WORDS = /\b(luong|thuong|bonus|nhan tien|nhan duoc|duoc cho|duoc tang|thu nhap|hoan tien|co tuc|lai tiet kiem|lai ngan hang|tien ve|freelance|ban duoc|tra lai tien)\b/;
const SAVING_WORDS = /\b(gui tiet kiem|tiet kiem|gui tk|rut tiet kiem|rut tk|tat toan)\b/;
const CHILD_WORDS = /\b(bim|ta giay|sua bot|sua cong thuc|mam non|hoc phi|do choi|cho con|cho be|cua con|cua be)\b/;
// Words too generic to match a family's own category by ("Tiền đi lại" should match on "đi lại", not "tiền").
const GENERIC = new Set(["tien", "chi", "phi", "cho", "cua", "va", "cac", "khac", "mua"]);
const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map((item) => item.name));

// "12/9", "12-09-2026", "ngày 12/9" (on the raw text: normalize() would drop the slash).
const DATE = /(?:^|\s)(?:ng[aà]y\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$|[,:;])/i;
const LEAD_DATE = /^(?:ng[aà]y\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$|[,:;])/i;
// An amount token: digits with separators, an optional unit, optionally "2tr5"; a leading sign means out/in.
const AMOUNT = /(?:^|\s)([-+−]?\d[\d.,]*\s?(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|m|đ|d|vnd)?\d?)(?=\s|$|[.,;!)])/gi;

function isoFrom(day: number, month: number, year: number | undefined, today: string): string | null {
  const [ty, tm] = today.split("-").map(Number);
  let y = year === undefined ? ty : year < 100 ? 2000 + year : year;
  // "28/12" typed in September means last December.
  if (year === undefined && month > tm) y -= 1;
  if (month < 1 || month > 12 || day < 1 || day > new Date(y, month, 0).getDate()) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const tidy = (content: string) => {
  const text = content.replace(/\bcf\b/gi, "cà phê").replace(/\bt(\d{1,2})\b/gi, "tháng $1").replace(/^[\s:,;.\-–—+*•]+|[\s:,;.\-–—]+$/g, "").replace(/\s+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

const shortVnd = (amount: number) => { const abs = Math.abs(amount); return abs >= 1_000_000 ? `${(abs / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr` : `${Math.round(abs / 1000)}k`; };
const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Category for one line: memory → earlier ledger entry → the family's own categories → keyword rules → fallback. */
function categorize(content: string, kind: MoneyKind, amount: number, context: QuickContext): Pick<QuickDraft, "category" | "unsure" | "suggestNew" | "forChild"> {
  const norm = normalize(content);
  const childWord = CHILD_WORDS.test(norm);
  if (kind === "saving") return { category: amount < 0 ? "Rút tiết kiệm" : childWord ? "Tiết kiệm cho con" : "Tiết kiệm", unsure: false, forChild: childWord };
  const active = context.categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  const has = (name: string) => active.includes(name);
  const key = memoryKey(content);
  const remembered = key ? context.memory?.[key] : undefined;
  if (remembered && has(remembered)) return { category: remembered, unsure: false, forChild: childWord };
  const earlier = key ? context.existing.find((tx) => tx.kind === kind && memoryKey(tx.content) === key && has(tx.category)) : undefined;
  if (earlier) return { category: earlier.category, unsure: false, forChild: earlier.forChild || childWord };
  const words = new Set(norm.split(" "));
  const own = active.filter((name) => !DEFAULT_NAMES.has(name)).find((name) => {
    const parts = normalize(name).split(" ").filter((word) => word.length >= 2 && !GENERIC.has(word));
    return parts.length > 0 && (parts.every((word) => words.has(word)) || parts.some((word) => word.length >= 3 && words.has(word)));
  });
  if (own) return { category: own, unsure: false, forChild: childWord };
  for (const rule of kind === "income" ? INCOME_RULES : EXPENSE_RULES) {
    if (!rule.test.test(norm)) continue;
    if (has(rule.category)) return { category: rule.category, unsure: false, forChild: Boolean(rule.child) || childWord };
    if (rule.fallback && has(rule.fallback)) return { category: rule.fallback, unsure: true, suggestNew: rule.category, forChild: childWord };
  }
  const fallback = has("Khác") ? "Khác" : active[0] ?? "Khác";
  return { category: fallback, unsure: true, forChild: childWord };
}

function duplicateOf(draft: Pick<QuickDraft, "kind" | "amount" | "content" | "category">, existing: MoneyTransaction[]): string | undefined {
  const key = memoryKey(draft.content);
  const hit = existing.find((tx) => tx.kind === draft.kind && tx.amount === draft.amount && (memoryKey(tx.content) === key || tx.category === draft.category));
  return hit ? `“${hit.content}” ${shortVnd(hit.amount)} ngày ${dayLabel(hit.occurredOn)}` : undefined;
}

function draftFor(content: string, amount: number, direction: "in" | "out" | undefined, occurredOn: string, dateNote: string | undefined, context: QuickContext): QuickDraft {
  const norm = normalize(content);
  const saving = SAVING_WORDS.test(norm);
  const kind: MoneyKind = saving ? "saving" : direction === "in" || (direction === undefined && INCOME_WORDS.test(norm)) ? "income" : "expense";
  const withdraw = saving && /\b(rut|tat toan)\b/.test(norm);
  const signed = kind === "saving" && withdraw ? -Math.abs(amount) : Math.abs(amount);
  const label = tidy(content) || (kind === "income" ? "Khoản thu" : kind === "saving" ? "Tiết kiệm" : "Khoản chi");
  const picked = categorize(label, kind, signed, context);
  const dupeOf = duplicateOf({ kind, amount: signed, content: label, category: picked.category }, context.existing);
  return { key: crypto.randomUUID(), occurredOn, content: label, kind, amount: signed, autoCategory: picked.category, dateNote, dupeOf, selected: !dupeOf, ...picked };
}

/** Splits pasted text into drafts. A date at the start of a line applies to the rest of it and to following lines. */
export function parseQuickList(text: string, context: QuickContext): QuickDraft[] {
  const drafts: QuickDraft[] = [];
  let carried: string | undefined;
  for (const rawLine of text.split(/\r?\n/).slice(0, 200)) {
    const line = rawLine.trim();
    if (!line) continue;
    const lead = line.match(LEAD_DATE);
    let lineDate = lead ? isoFrom(Number(lead[1]), Number(lead[2]), lead[3] ? Number(lead[3]) : undefined, context.today) ?? undefined : undefined;
    const items = line.split(/[;]|,(?!\d)|\s[|•]\s/).map((item) => item.trim()).filter(Boolean);
    for (const item of items) {
      const own = item.match(DATE);
      const ownDate = own ? isoFrom(Number(own[1]), Number(own[2]), own[3] ? Number(own[3]) : undefined, context.today) ?? undefined : undefined;
      // Amount: the last token that reads as money, ignoring the date.
      const scan = item.replace(DATE, " ");
      const tokens = [...scan.matchAll(AMOUNT)].map((match) => match[1]);
      let amount: number | null = null; let token = "";
      for (const candidate of tokens.reverse()) { const value = parseVnd(candidate.replace(/\s+/g, "")); if (value !== null && Math.abs(value) >= 1000) { amount = value; token = candidate; break; } }
      if (amount === null) continue;
      const direction = /^\s*[+]/.test(token) ? "in" : /^\s*[-−]/.test(token) ? "out" : undefined;
      const content = scan.replace(token, " ");
      const date = ownDate ?? lineDate ?? carried;
      const dateNote = ownDate || lineDate ? undefined : carried ? "ngày theo dòng trên" : "không ghi ngày, lấy hôm nay";
      drafts.push(draftFor(content, Math.abs(amount), direction, date ?? context.today, dateNote, context));
      if (ownDate) lineDate = lineDate ?? ownDate;
    }
    if (lineDate) carried = lineDate;
  }
  return drafts;
}

/** Drafts from lines a photo model read (bank statement, app screenshot, receipt, notebook page). */
export function draftsFromImage(lines: ImageLine[], context: QuickContext): QuickDraft[] {
  return lines.filter((line) => line.amount > 0).map((line) => draftFor(line.content, line.amount, line.direction, line.date && line.date <= context.today ? line.date : context.today, line.date ? undefined : "ảnh không ghi ngày, lấy hôm nay", context));
}

/** Memory after saving: remember lines whose category the family changed (newest wins, at most 300 keys). */
export function rememberCorrections(memory: Record<string, string> | undefined, drafts: QuickDraft[]): Record<string, string> | undefined {
  const changed = drafts.filter((draft) => draft.selected && draft.category !== draft.autoCategory && draft.kind !== "saving" && memoryKey(draft.content));
  if (!changed.length) return undefined;
  const next = { ...(memory ?? {}) };
  for (const draft of changed) { const key = memoryKey(draft.content); delete next[key]; next[key] = draft.category; }
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - 300))) delete next[key];
  return next;
}

export const isSavingCategory = (name: string) => SAVING_CATEGORIES.includes(name);

/** Category for a single named item (e.g. a fixed monthly item from the Tình hình setup), same rules as quick add. */
export const guessCategory = (content: string, kind: Exclude<MoneyKind, "saving">, context: QuickContext) => categorize(content, kind, 1, context).category;
