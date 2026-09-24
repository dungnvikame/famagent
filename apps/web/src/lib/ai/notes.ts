import type { FamilyProfile } from "../experience/types.ts";

/**
 * Conversation-derived family notes (SPEC_V2 §31 shared memory; decision 24/09: saved automatically, labelled
 * "Ghi nhận"). Rules only — the phrases parents actually type; an LLM pass can extend this later.
 * Each note is ≤160 chars, names the child when known, and carries a kind for later use by agents.
 */
export interface FamilyNote {
  id: string;
  text: string;
  kind: "health" | "habit" | "preference" | "other";
  status: "recorded" | "confirmed";
  /** Brand the note is about, when it names one (used to steer recommendations). */
  brand?: string;
  childId?: string;
  sourceConversationId?: string;
  /** ISO timestamp */
  createdAt: string;
}

export interface NoteCandidate { text: string; kind: FamilyNote["kind"]; brand?: string; childId?: string }

const MERCHANTS = ["shopee", "lazada", "tiki", "tiktok", "concung", "con cưng", "bibo mart", "kids plaza", "siêu thị", "chợ", "nhà thuốc"];
const clean = (value: string) => value.trim().replace(/[.,;!?]+$/, "");
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Finds a known catalog brand mentioned in the text (case-insensitive, whole word). */
function brandIn(text: string, brands: string[]): string | undefined {
  const lower = text.toLocaleLowerCase("vi");
  return brands.find((brand) => new RegExp(`(?<![\\p{L}])${brand.toLocaleLowerCase("vi").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(lower));
}

export function extractNotes(message: string, profile: FamilyProfile | null, brands: string[] = []): NoteCandidate[] {
  const text = message.trim();
  if (text.length < 8 || text.length > 400) return [];
  const lower = text.toLocaleLowerCase("vi");
  const children = profile?.children ?? [];
  const named = children.find((child) => child.name && lower.includes(child.name.toLocaleLowerCase("vi"))) ?? (children.length === 1 ? children[0] : undefined);
  const who = named?.name ? `Bé ${named.name}` : "Bé";
  const brand = brandIn(text, brands) ?? text.match(/(?:dùng|xài|mua|hãng|loại|thương hiệu)\s+([A-Z][\p{L}\d]+(?:\s+[A-Z][\p{L}\d]+)?)/u)?.[1];
  const out: NoteCandidate[] = [];

  // Health: rash / allergy / irritation with a product or brand.
  if (/(bị|hay|dễ)\s*(hăm|dị ứng|kích ứng|nổi mẩn|mẩn đỏ|ngứa)/.test(lower)) {
    const symptom = lower.match(/hăm|dị ứng|kích ứng|nổi mẩn|mẩn đỏ|ngứa/)![0];
    out.push({ text: brand ? `${who} bị ${symptom} khi dùng ${brand}` : `${who} ${lower.includes("dễ") ? "dễ" : "hay"} bị ${symptom}`, kind: "health", brand, childId: named?.id });
  }
  // Habit: where / when the family usually buys.
  const merchant = MERCHANTS.find((name) => lower.includes(name));
  if (merchant && /(thường|hay|toàn|luôn|quen)\s+(mua|đặt|lấy)/.test(lower)) out.push({ text: `Nhà thường mua trên ${cap(merchant)}${/(sale|khuyến mãi|giảm giá|đợt|ngày đôi)/.test(lower) ? " vào đợt khuyến mãi" : ""}`, kind: "habit" });
  if (/(mua|đặt)\s+(theo|mỗi|hằng|hàng)\s*tháng|mỗi tháng (mua|đặt)|một tháng (mua|đặt)/.test(lower)) out.push({ text: `Nhà mua ${brand ? `${brand} ` : ""}theo tháng${text.match(/(\d+)\s*(gói|bịch|thùng)/) ? ` (${text.match(/(\d+)\s*(gói|bịch|thùng)/)![0]})` : ""}`, kind: "habit", brand });

  // Preference: likes / dislikes a brand or a property.
  if (brand && /(thích|ưng|hợp|quen dùng|dùng quen|ổn|tốt)\b/.test(lower) && !/(không|chẳng|chả)\s+(thích|ưng|hợp)/.test(lower) && !out.some((note) => note.kind === "health")) out.push({ text: `${who} hợp với ${brand}`, kind: "preference", brand, childId: named?.id });
  if (brand && /(không|chẳng|chả)\s+(thích|ưng|hợp|dùng)|ghét|tránh/.test(lower) && !out.some((note) => note.kind === "health")) out.push({ text: `${who} không hợp ${brand}`, kind: "preference", brand, childId: named?.id });
  if (/(đêm|ban đêm|tối)\b.*(tràn|ướt|thấm)|(tràn|ướt).*(đêm|tối)/.test(lower)) out.push({ text: `${who} hay bị tràn ban đêm`, kind: "preference", childId: named?.id });
  if (/(mỏng|thoáng|mát)\b.*(thích|ưu tiên|cần)|(thích|ưu tiên|cần).*(mỏng|thoáng|mát)/.test(lower)) out.push({ text: `Ưu tiên bỉm mỏng, thoáng cho ${who.toLowerCase()}`, kind: "preference", childId: named?.id });

  return out.map((note) => ({ ...note, text: clean(note.text).slice(0, 160) })).filter((note, index, all) => all.findIndex((other) => other.text === note.text) === index);
}

/** New notes only: same text (case/space-insensitive) as an existing note is skipped. */
export function newNotes(candidates: NoteCandidate[], existing: Pick<FamilyNote, "text">[]): NoteCandidate[] {
  const seen = new Set(existing.map((note) => note.text.toLocaleLowerCase("vi").replace(/\s+/g, " ")));
  return candidates.filter((note) => !seen.has(note.text.toLocaleLowerCase("vi").replace(/\s+/g, " ")));
}

/** Brands that a health note says caused a reaction → hard-excluded in shopping, with the note as the reason. */
export function brandsToAvoid(notes: Pick<FamilyNote, "kind" | "brand" | "text">[]): Array<{ brand: string; reason: string }> {
  return notes.filter((note) => note.kind === "health" && note.brand).map((note) => ({ brand: note.brand!, reason: note.text }));
}
