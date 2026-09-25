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
  /** Placed by the model (second pass), shown so the family double-checks. */
  aiPicked?: boolean;
  /** Also make it a monthly recurring item (on this line's day). */
  repeat: boolean;
  /** Looks like a monthly item (rent, school fee, salary…): suggested, never ticked for the family. */
  repeatHint: boolean;
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
  /** The children's names ("Gold"): a line naming a child is spending for that child. */
  children?: string[];
}

/** One line read from a photo by the vision model. */
export interface ImageLine { date: string | null; content: string; amount: number; direction: "in" | "out" }

/** Lowercase, no Vietnamese marks, single spaces: "Cà phê  Highlands" → "ca phe highlands". */
export const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** Memory key: the first two words without numbers ("Đổ xăng xe máy 80k" → "do xang"). */
export const memoryKey = (content: string) => normalize(content).split(" ").filter((word) => word && !/\d/.test(word)).slice(0, 2).join(" ");

type Rule = { test: RegExp; category: string; child?: boolean; fallback?: string; /** Match on the lowercased text with marks ("váy" ≠ "vay"). */ raw?: boolean };
// Order matters: child items before shops and food ("bỉm shopee", "kem hăm" are for the child), bills before food.
const EXPENSE_RULES: Rule[] = [
  { test: /\b(bim|ta giay|ta dan|ta quan|ta vai|sua bot|sua cong thuc|sua non|binh sua|num ti|ti gia|hut mui|dau hut|ro luoi|gac ro|khan sua|khan xo|yem|xe day|ghe an|ghe o to|noi em be|cui|may hut sua|tui tru sua|phan rom|kem ham|sua tam be|dau tram|quan ao be|do so sinh|do choi|khan uot|giay uot|an dam|bot an dam|chao dinh duong|vitamin d3|men vi sinh|cho be|cua be|cho con|cua con|be yeu)\b/, category: "Con", child: true },
  { test: /\b(hoc phi|mam non|nha tre|hoc them|tien hoc|gia su|nang khieu|hoc boi|hoc ve|hoc dan|dong phuc)\b/, category: "Học tập", child: true },
  { test: /\b(sach|vo viet|but|dung cu hoc tap|khoa hoc|hoc online|tieng anh|ielts|hoc lai xe)\b/, category: "Học tập" },
  { test: /\b(tien dien|hoa don dien|dien sinh hoat|dien t\d{1,2}|dien thang|evn)\b|^dien\b(?! thoai| may)/, category: "Tiền điện" },
  { test: /\b(tien nuoc|hoa don nuoc|nuoc sinh hoat|nuoc t\d{1,2}|nuoc thang)\b/, category: "Tiền nước" },
  { test: /\btra gop\b/, category: "Tiền trả góp" },
  { test: /\b(the tin dung|tra the|sao ke the|du no the)\b/, category: "Tiền thẻ tín dụng" },
  { test: /\b(thuoc|kham|benh vien|phong kham|nha thuoc|pharmacity|long chau|an khang|nha khoa|xet nghiem|sieu am|chup x quang|tiem|vac xin|vaccine|vitamin|siro|kinh mat can|bao hiem y te|bhyt|vien phi)\b/, category: "Khám, thuốc" },
  { test: /\b(dam cuoi|an cuoi|mung cuoi|phong bi|dam hieu|vieng|dam gio|dam ma|chia buon|thoi noi|day thang|mung tho|li xi|mung tuoi|tan gia)\b/, category: "Hiếu hỉ" },
  { test: /\b(bieu|bo me|ong ba|noi ngoai|tien nha|thue nha|tien phong|sinh nhat|trang tri|bong bay|banh kem|qua tang|mua qua|tet)\b/, category: "Gia đình" },
  { test: /\b(du lich|khach san|ve may bay|homestay|resort|tour|booking|agoda|traveloka|vinpearl)\b/, category: "Du lịch" },
  { test: /\b(xang|do xang|xe om|grab bike|grabbike|grab car|be bike|be car|gojek|xanh sm|taxi|gui xe|do xe|ve xe|ve tau|sua xe|rua xe|thay dau|bao duong xe|dang kiem|cau duong|phi duong bo|vetc|epass)\b|^grab\b/, category: "Đi lại", fallback: "Tiêu dùng" },
  { test: /\b(an sang|an trua|an toi|an vat|an dem|an uong|an ngoai|cafe|ca phe|cf|cacao|ca cao|tra sua|tra chanh|tra da|tra dao|sinh to|nuoc ep|nuoc ngot|coca|pepsi|bia|ruou|banh mi|banh bao|banh ngot|banh|keo|snack|bun|pho|com|xoi|chao|mien|mi tom|hu tieu|lau|nuong|ga ran|ga nuong|thit ga|vit|hai san|sushi|pizza|kfc|lotteria|jollibee|mcdonald|highlands|starbucks|phuc long|katinat|cong ca|grabfood|shopeefood|baemin|do an|thuc an|di cho|cho dem|rau|thit|ca kho|ca hoi|trung ga|trung vit|trai cay|hoa qua|nuoc mia|sieu thi|bach hoa|bach hoa xanh|tap hoa|winmart|coopmart|co op|big c|go mart|aeon|lotte mart|circle k|gs25|family mart|7 eleven|ministop)\b|\bkem\b(?! (duong|chong nang|danh rang|tri|boi|ham|nen|mat|lot|body|mat na))/, category: "Ăn uống" },
  { test: /\b(phim|cgv|lotte cinema|bhd|galaxy cinema|karaoke|game|steam|netflix|spotify|youtube|vui choi|cong vien|bowling|bida|gym|the thao|san bong|cau long|boi loi)\b/, category: "Giải trí" },
  { test: /\b(internet|wifi|fpt|viettel|vnpt|mobifone|vinaphone|sim|esim|e sim|4g|5g|data|goi cuoc|cuoc dien thoai|nap the|nap dien thoai|icloud|google one|gas|xa phong|bot giat|nuoc giat|nuoc xa|nuoc rua|giay ve sinh|khan giay|dau goi|sua tam|kem danh rang|ban chai|phi quan ly|phi dich vu|tien rac|giup viec|osin|don nha|sua nha|tho dien|tho nuoc)\b/, category: "Tiêu dùng" },
  { test: /\b(shopee|lazada|tiki|tiktok|sendo|quan ao|giay dep|my pham|kem duong|sua rua mat|serum|toner|kem chong nang|son moi|nuoc hoa|lam dep|spa|nail|cat toc|lam toc|goi dau|do gia dung|dien may|chan ga|goi om|tui xach|dong ho|trang suc|phu kien|op lung|tai nghe)\b/, category: "Mua sắm" },
  { test: /(?<!\p{L})(váy|đầm|áo|quần|giày|dép|túi|mũ|nón)(?!\p{L})/u, raw: true, category: "Mua sắm" },
  { test: /\b(dau tu|chung khoan|co phieu|chung chi quy|mua vang|vang|crypto|bitcoin)\b/, category: "Chi phí đầu tư" },
];
const INCOME_RULES: Rule[] = [
  { test: /\bluong\b/, category: "Lương" },
  { test: /\b(thuong|bonus|luong thang 13)\b/, category: "Thưởng" },
  { test: /\b(co tuc|lai tiet kiem|lai ngan hang|ban co phieu|loi nhuan|ban vang)\b/, category: "Đầu tư" },
  { test: /(?<!\p{L})(lời|lãi|tiền lãi|lãi suất)(?!\p{L})/u, raw: true, category: "Đầu tư" },
  { test: /\b(freelance|du an|lam them|job ngoai|ban hang|hoa hong)\b/, category: "Dự án ngoài" },
  { test: /\b(bo me cho|ong ba cho|duoc cho|me cho|bo cho|ho tro|mung tuoi|li xi)\b/, category: "Gia đình hỗ trợ" },
  { test: /\b(tra no|tra lai tien)\b/, category: "Tiền trả nợ nhận về" },
];
const INCOME_WORDS = /\b(luong|thuong|bonus|nhan tien|nhan duoc|duoc cho|duoc tang|thu nhap|hoan tien|co tuc|lai tiet kiem|lai ngan hang|tien ve|freelance|ban duoc|tra lai tien)\b/;
const SAVING_WORDS = /\b(gui tiet kiem|tiet kiem|gui tk|rut tiet kiem|rut tk|tat toan)\b/;
const CHILD_WORDS = /\b(bim|ta giay|sua bot|sua cong thuc|mam non|hoc phi|do choi|hut mui|ro luoi|binh sua|an dam|cho con|cho be|cua con|cua be)\b/;
// Categories that stay as they are when a child's name appears (the rest become "Con").
const CHILD_KEEP = new Set(["Con", "Học tập", "Khám, thuốc", "Tiết kiệm cho con"]);

/**
 * Borrowing and lending, read on the text with marks so "váy" (a dress) is never "vay" (a loan):
 * "vay ngân hàng 50tr" = money in; "Tom vay 5tr", "cho chị Hà mượn" = money lent out; "anh Nam trả nợ" = repaid to us.
 */
function loanOf(raw: string): { kind: "income" | "expense"; category: string } | null {
  const text = raw.toLowerCase().normalize("NFC").trim();
  const word = (w: string) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, "u");
  const borrowWord = word("(vay|mượn)");
  if (/^(đi |đang |mới )?(vay|mượn)(?!\p{L})/u.test(text)) return { kind: "income", category: /ngân hàng|bank|tín chấp|thế chấp|tài chính|fe credit|home credit|vpbank|techcombank|vietcombank|bidv|agribank|tpbank|mb bank/.test(text) ? "Vay ngân hàng" : "Vay cá nhân" };
  if (word("cho").test(text) && borrowWord.test(text) && /cho(?:\s+\p{L}+){0,3}\s+(vay|mượn)(?!\p{L})/u.test(text)) return { kind: "expense", category: "Tiền cho vay" };
  if (borrowWord.test(text)) return { kind: "expense", category: "Tiền cho vay" }; // "<ai đó> vay/mượn" — the family lent it
  if (/^(trả nợ|trả tiền vay|trả lại tiền|trả tiền)(?!\p{L})/u.test(text)) return { kind: "expense", category: "Tiền trả nợ" };
  // "<ai đó> trả nợ / trả lại / trả" (someone paid us back): "trả" after a name, never "trả góp" or a line starting with "trả".
  if (!/^trả/u.test(text) && (/(?<!\p{L})trả (nợ|lại|tiền)(?!\p{L})/u.test(text) || /(?<!\p{L})trả\s*$/u.test(text))) return { kind: "income", category: "Tiền trả nợ nhận về" };
  return null;
}
// Words too generic to match a family's own category by ("Tiền đi lại" should match on "đi lại", not "tiền").
const GENERIC = new Set(["tien", "chi", "phi", "cho", "cua", "va", "cac", "khac", "mua"]);
const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map((item) => item.name));

// "12/9", "12-09-2026", "ngày 12/9" (on the raw text: normalize() would drop the slash).
const DATE = /(?:^|\s)(?:ng[aà]y\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$|[,:;])/i;
const LEAD_DATE = /^(?:ng[aà]y\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$|[,:;])/i;
// An amount token: digits with separators, an optional unit, optionally "2tr5"; a leading sign means out/in.
// A space is allowed only before a unit ("350 k"), so "tháng 9 1,2tr" reads 1,2tr — not "9 1".
const AMOUNT = /(?:^|\s)([-+−]?\d[\d.,]*(?:\s?(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|m|đ|d|vnd)\d?)?)(?=\s|$|[.,;!)])/gi;

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
  const loan = loanOf(content);
  if (loan && loan.kind === kind && has(loan.category)) return { category: loan.category, unsure: false, forChild: false };
  // A child's name in the line ("trang trí sinh nhật Gold") means the spend is for that child.
  const childNamed = (context.children ?? []).some((name) => normalize(name).split(" ").some((part) => part.length >= 2 && words.has(part)));
  const forChildOf = (category: string) => kind === "expense" && childNamed && !CHILD_KEEP.has(category) && has("Con") ? "Con" : category;
  const raw = content.toLowerCase().normalize("NFC");
  for (const rule of kind === "income" ? INCOME_RULES : EXPENSE_RULES) {
    if (!rule.test.test(rule.raw ? raw : norm)) continue;
    if (has(rule.category)) return { category: forChildOf(rule.category), unsure: false, forChild: Boolean(rule.child) || childWord || childNamed };
    if (rule.fallback && has(rule.fallback)) return { category: rule.fallback, unsure: true, suggestNew: rule.category, forChild: childWord || childNamed };
  }
  if (childNamed && kind === "expense" && has("Con")) return { category: "Con", unsure: false, forChild: true };
  const fallback = has("Khác") ? "Khác" : active[0] ?? "Khác";
  return { category: fallback, unsure: true, forChild: childWord };
}

function duplicateOf(draft: Pick<QuickDraft, "kind" | "amount" | "content" | "category">, existing: MoneyTransaction[]): string | undefined {
  const key = memoryKey(draft.content);
  const hit = existing.find((tx) => tx.kind === draft.kind && tx.amount === draft.amount && (memoryKey(tx.content) === key || tx.category === draft.category));
  return hit ? `“${hit.content}” ${shortVnd(hit.amount)} ngày ${dayLabel(hit.occurredOn)}` : undefined;
}

// Profit / interest words, on the marked text ("lãi" ≠ "lại", "lời" ≠ "lỗi").
const PROFIT_WORDS = /(?<!\p{L})(lời|lãi|tiền lãi|lãi suất)(?!\p{L})/u;
// Lines that usually repeat every month: suggested (never ticked) for "Hằng tháng" in the review.
const MONTHLY_HINT = /\b(tien nha|thue nha|tien phong|hoc phi|mam non|nha tre|internet|wifi|cuoc|goi cuoc|luong|tra gop|bao hiem|phi quan ly|gui xe thang|tien dien|tien nuoc|dien thang|nuoc thang|netflix|spotify|youtube premium|icloud|google one|giup viec)\b/;

/**
 * A line with no amount that tells the kind for the lines after it: a sentence ("Nhập tất cả khoản dưới đây thành
 * khoản Thu") or a header ("Thu:", "Khoản chi"). Returns the kind, or null when the line is not such an instruction.
 */
export function kindDirective(line: string): MoneyKind | null {
  const norm = normalize(line);
  const target = (word: string) => /^thu/.test(word) ? "income" : /^chi/.test(word) ? "expense" : "saving";
  const header = norm.match(/^(?:cac |nhung )?(?:khoan )?(thu nhap|thu|chi tieu|chi|tiet kiem)(?: nhap| vao| thang \d{1,2})?$/);
  if (header) return target(header[1]);
  if (!/\b(nhap|ghi|them|chuyen|xep|danh dau|tat ca|toan bo|het|deu|nhung khoan|cac khoan|duoi day)\b/.test(norm)) return null;
  const sentence = norm.match(/\b(?:khoan|thanh|la|vao|loai|muc|kieu)\s+(thu nhap|thu|chi tieu|chi|tiet kiem)\b/);
  return sentence ? target(sentence[1]) : null;
}

function draftFor(content: string, amount: number, direction: "in" | "out" | undefined, occurredOn: string, dateNote: string | undefined, context: QuickContext, forced?: MoneyKind): QuickDraft {
  const norm = normalize(content);
  // "lãi tiết kiệm" is interest earned (income), not a transfer into savings.
  const saving = SAVING_WORDS.test(norm) && !PROFIT_WORDS.test(content.toLowerCase().normalize("NFC"));
  const loan = saving ? null : loanOf(content);
  const income = INCOME_WORDS.test(norm) || PROFIT_WORDS.test(content.toLowerCase().normalize("NFC"));
  const kind: MoneyKind = forced ?? (saving ? "saving" : direction === "in" ? "income" : direction === "out" ? "expense" : loan ? loan.kind : income ? "income" : "expense");
  const withdraw = saving && /\b(rut|tat toan)\b/.test(norm);
  const signed = kind === "saving" && withdraw ? -Math.abs(amount) : Math.abs(amount);
  const label = tidy(content) || (kind === "income" ? "Khoản thu" : kind === "saving" ? "Tiết kiệm" : "Khoản chi");
  const picked = categorize(label, kind, signed, context);
  const dupeOf = duplicateOf({ kind, amount: signed, content: label, category: picked.category }, context.existing);
  return { key: crypto.randomUUID(), occurredOn, content: label, kind, amount: signed, autoCategory: picked.category, dateNote, dupeOf, selected: !dupeOf, repeat: false, repeatHint: kind !== "saving" && MONTHLY_HINT.test(norm), ...picked };
}

/** Splits pasted text into drafts. A date at the start of a line applies to the rest of it and to following lines. */
export function parseQuickList(text: string, context: QuickContext): QuickDraft[] {
  const drafts: QuickDraft[] = [];
  let carried: string | undefined;
  let forced: MoneyKind | undefined;
  for (const rawLine of text.split(/\r?\n/).slice(0, 300)) {
    const line = rawLine.trim();
    if (!line) continue;
    // "Nhập tất cả thành khoản Thu" / "Chi:" set the kind of the lines that follow (no amount on that line).
    const directive = kindDirective(line);
    if (directive && ![...line.replace(DATE, " ").matchAll(AMOUNT)].some((match) => Math.abs(parseVnd(match[1].replace(/\s+/g, "")) ?? 0) >= 1000)) { forced = directive; continue; }
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
      drafts.push(draftFor(content, Math.abs(amount), direction, date ?? context.today, dateNote, context, forced));
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
