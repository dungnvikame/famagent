// Universal Inbox (core journey spec §2): one sentence in, the right record out. A purchase of something the family
// uses (Expense + Purchase + stock), a plain expense, income, a question for the agent, or a product link. Rules only;
// every draft is confirmed ("Đúng" / "Sửa") before anything is written.
import { CATEGORY_WORDS, cut, findAmount, findDate, fold, FOLDED_NEED, NEED, parsePurchase, PRICE_LIMIT, type PurchaseDraft } from "../shopping/capture.ts";
import { CATEGORY_LABELS, matchItem, type ShoppingItem } from "../shopping/items.ts";
import type { ChildProfile } from "../experience/types.ts";

export interface ExpenseDraft { kind: "expense" | "income"; content: string; amount: number; category: string; occurredOn: string; forChild: boolean }
export type InboxResult =
  | { kind: "purchase"; purchase: PurchaseDraft }
  | { kind: "expense" | "income"; money: ExpenseDraft }
  | { kind: "link"; url: string; note: string }
  | { kind: "question"; text: string };

/** Ledger categories (DEFAULT_CATEGORIES) guessed from everyday words; first match wins. */
const EXPENSE_WORDS: Array<[RegExp, string]> = [
  [/\b(tien dien|dien thang|hoa don dien)\b/, "Tiền điện"], [/\b(tien nuoc|hoa don nuoc)\b/, "Tiền nước"],
  [/\b(tra gop)\b/, "Tiền trả góp"], [/\b(the tin dung)\b/, "Tiền thẻ tín dụng"], [/\b(tra no)\b/, "Tiền trả nợ"],
  [/\b(thuoc|kham|benh vien|nha khoa|tiem|xet nghiem)\b/, "Khám, thuốc"],
  [/\b(hoc phi|hoc them|khoa hoc|sach vo|truong)\b/, "Học tập"],
  [/\b(dam cuoi|dam hoi|mung cuoi|phung|sinh nhat|qua tang|mung tuoi|li xi|lixi)\b/, "Hiếu hỉ"],
  [/\b(du lich|khach san|homestay|ve may bay|ve tau)\b/, "Du lịch"],
  [/\b(phim|karaoke|game|netflix|spotify|youtube|gym|the thao)\b/, "Giải trí"],
  [/\b(an sang|an trua|an toi|an vat|ca phe|cafe|coffee|tra sua|com|pho|bun|lau|nuong|nha hang|quan an|an ngoai|do an|grabfood|shopeefood|banh mi|uong)\b/, "Ăn uống"],
  [/\b(bo me|ong ba|bieu|gui ve que)\b/, "Gia đình"],
  [/\b(cho be|cho con|hoc cho con|do choi|bim|sua cho be)\b/, "Con"],
  [/\b(xang|grab|taxi|be\b|gui xe|ve xe|di cho|sieu thi|rau|thit|ca|trai cay|dien thoai|internet|wifi|gas)\b/, "Tiêu dùng"],
  [/\bmua\b/, "Mua sắm"],
];
const INCOME_WORDS: Array<[RegExp, string]> = [[/\b(luong)\b/, "Lương"], [/\b(thuong)\b/, "Thưởng"], [/\b(co tuc|lai tiet kiem|lai ngan hang|dau tu)\b/, "Đầu tư"], [/\b(ba me cho|ong ba cho|gia dinh ho tro|mung)\b/, "Gia đình hỗ trợ"], [/\b(tra no cho minh|tra lai tien)\b/, "Tiền trả nợ nhận về"], [/\b(nhan|duoc|thu ve|ve tai khoan|hoan tien|freelance|du an)\b/, "Khác"]];
const QUESTION = /\?|^(bao nhieu|the nao|sao|tai sao|co nen|nen|lam sao|xem|cho (toi|minh) (xem|biet)|thang nay|tuan nay|con bao nhieu|goi y|so sanh|tim|mua lai)\b/;
const URL = /https?:\/\/[^\s]+/i;
const FILLER = /\b(hom nay|hom qua|hom kia|sang nay|trua nay|chieu nay|toi qua|vua|moi|da|roi|xong|het|mat|tieu|chi|tra|tien)\b/g;
const CONSUMABLE = new Set(["diapers", "wipes", "milk", "solids", "hygiene", "household"]);

/** What the sentence is, with a draft ready for the confirmation card. `today` = YYYY-MM-DD. */
export function classifyInbox(text: string, items: ShoppingItem[], today: string): InboxResult {
  const trimmed = text.trim();
  const link = URL.exec(trimmed);
  if (link) return { kind: "link", url: link[0].replace(/[),.]+$/, ""), note: trimmed.replace(link[0], "").trim() };
  const lower = trimmed.toLocaleLowerCase("vi");
  const folded = fold(trimmed);
  const amount = findAmount(trimmed);
  if (!amount || QUESTION.test(folded) || NEED.test(lower) || FOLDED_NEED.test(folded) || PRICE_LIMIT.test(lower)) return { kind: "question", text: trimmed };

  const buys = /\bmua\b/.test(folded);
  const consumable = CATEGORY_WORDS.some(([pattern, category]) => CONSUMABLE.has(category) && pattern.test(folded));
  if (buys && (consumable || matchItem(trimmed, items.filter((item) => item.status !== "outgrown")))) return { kind: "purchase", purchase: parsePurchase(trimmed, items, today) };

  const date = findDate(folded, today);
  const spans = [amount.span, ...(date.span ? [date.span] : [])];
  const rest = fold(cut(trimmed, spans));
  let content = cut(trimmed, spans);
  content = [...rest.matchAll(FILLER)].reverse().reduce((acc, match) => acc.slice(0, match.index) + " ".repeat(match[0].length) + acc.slice(match.index + match[0].length), content);
  content = content.replace(/[,.;:!]+/g, " ").replace(/\s+/g, " ").trim();
  content = content ? content[0].toLocaleUpperCase("vi") + content.slice(1) : "Khoản chi";
  const income = !buys && INCOME_WORDS.find(([pattern]) => pattern.test(folded));
  if (income) return { kind: "income", money: { kind: "income", content: content.slice(0, 120), amount: amount.value, category: income[1], occurredOn: date.on, forChild: false } };
  const category = EXPENSE_WORDS.find(([pattern]) => pattern.test(folded))?.[1] ?? "Khác";
  return { kind: "expense", money: { kind: "expense", content: content.slice(0, 120), amount: amount.value, category, occurredOn: date.on, forChild: category === "Con" } };
}

const short = (amount: number) => amount >= 1_000_000 ? `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}M` : `${Math.round(amount / 1000)}K`;
const when = (on: string, today: string) => on === today ? "hôm nay" : `ngày ${Number(on.slice(8))}/${Number(on.slice(5, 7))}`;

/** "Merries L64 cho Gold, 369K ở Shopee, hôm nay" — the one-line reading shown before "Đúng / Sửa". */
export function purchaseSummary(draft: PurchaseDraft, children: ChildProfile[], today: string, itemChildId?: string): string {
  const child = children.find((entry) => entry.id === itemChildId) ?? (children.length === 1 ? children[0] : undefined);
  const forWho = child?.name && CONSUMABLE.has(draft.category) && draft.category !== "household" ? ` cho ${child.name}` : "";
  const pack = draft.packSize && draft.packSize > 1 ? ` (${draft.packs > 1 ? `${draft.packs} × ` : ""}${draft.packSize} ${draft.unit})` : draft.packs > 1 ? ` × ${draft.packs}` : "";
  return `${draft.name}${pack}${forWho}${draft.amount ? `, ${short(draft.amount)}` : ""}${draft.merchant ? ` ở ${draft.merchant}` : ""}, ${when(draft.purchasedOn, today)}`;
}

export function moneySummary(draft: ExpenseDraft, today: string): string {
  return `${draft.kind === "income" ? "Thu" : "Chi"} ${short(draft.amount)} · ${draft.category} · “${draft.content}” · ${when(draft.occurredOn, today)}`;
}

export const categoryLabel = (draft: PurchaseDraft) => CATEGORY_LABELS[draft.category];
