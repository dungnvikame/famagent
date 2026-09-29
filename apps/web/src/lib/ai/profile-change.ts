import type { FamilyProfile } from "@/lib/experience/types";
import { stampChanges } from "../experience/profile-meta.ts";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const NOT_LETTER = "(?![\\p{L}])";
// Typed with diacritics → match diacritics exactly ("sửa" ≠ "sữa"); typed without → match the folded spelling.
const COMMAND = {
  accented: new RegExp(`^(?:(?:giúp|nhờ|hãy|làm ơn|vui lòng|cho)\\s+(?:mình|tôi|em|anh|chị)?\\s*)*(?:cập nhật|sửa|đổi|thay|đặt|chỉnh|điều chỉnh)(?:\\s+lại)?${NOT_LETTER}`, "u"),
  folded: new RegExp(`^(?:(?:giup|nho|hay|lam on|vui long|cho)\\s+(?:minh|toi|em|anh|chi)?\\s*)*(?:cap nhat|sua|doi|thay|dat|chinh|dieu chinh)(?:\\s+lai)?${NOT_LETTER}`, "u"),
};
// Any shopping / search wording means the message is a request, never a profile edit ("muốn thay hãng cho bé 9kg dưới 300k").
const SHOPPING = {
  accented: new RegExp(`(?<![\\p{L}])(?:mua|tìm|bỉm|tã|gợi ý|đề xuất|so sánh|hãng|thương hiệu|loại khác|lựa chọn|sữa|khăn|nước giặt|rẻ hơn|bao nhiêu|nên)${NOT_LETTER}`, "u"),
  folded: new RegExp(`(?<![\\p{L}])(?:mua|tim|bim|goi y|de xuat|so sanh|hang|thuong hieu|loai khac|lua chon|re hon|bao nhieu|nen)${NOT_LETTER}`, "u"),
};

/** True when the message opens with an explicit edit command and carries no shopping intent. */
export function isProfileEditCommand(message: string): boolean {
  const lower = message.trim().toLocaleLowerCase("vi");
  const mode = fold(lower) === lower ? "folded" : "accented";
  return COMMAND[mode].test(lower) && !SHOPPING[mode].test(lower);
}

export function parseProfileChange(message: string, profile: FamilyProfile | null): FamilyProfile | null {
  if (!profile || !isProfileEditCommand(message)) return null;
  const lower = message.toLocaleLowerCase("vi");
  const updated: FamilyProfile = { ...profile, children: profile.children.map((child) => ({ ...child })), updatedAt: new Date().toISOString() };
  let changed = false;
  const childIndex = updated.children.findIndex((child) => child.name && lower.includes(child.name.toLocaleLowerCase("vi")));
  const targetIndex = childIndex >= 0 ? childIndex : updated.children.length === 1 ? 0 : -1;
  if (targetIndex >= 0) {
    const weight = message.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:kg|ký|kí)/i);
    const size = message.match(/(?:size|cỡ)\s*(?:thành|là|sang)?\s*(NB|S|M|L|XL|XXL)\b/i);
    if (weight) { const kg = Number(weight[1].replace(",", ".")); if (kg >= 2 && kg <= 30) { updated.children[targetIndex].weightKg = kg; changed = true; } }
    if (size) { updated.children[targetIndex].diaperSize = size[1].toUpperCase(); changed = true; }
  }
  const budget = message.match(/(?:ngân sách|ngan sach|giới hạn giá|gioi han gia|mức giá|muc gia)\s*(?:tối đa|toi da|thành|thanh|là|la|dưới|duoi)?\s*(\d{1,7})\s*(k|nghìn|ngàn|triệu|đ|vnd)?/i);
  if (budget) { const base = Number(budget[1]); const amount = /triệu/i.test(budget[2] ?? "") ? base * 1_000_000 : /^(k|nghìn|ngàn)$/i.test(budget[2] ?? "") || (base < 10000 && !budget[2]) ? base * 1000 : base; if (amount >= 50_000 && amount <= 100_000_000) { updated.maxBudget = amount; changed = true; } }
  if (/ưu tiên (?:giá tốt|tiết kiệm)/.test(lower)) { updated.pricePreference = "budget"; changed = true; }
  if (/ưu tiên (?:cao cấp|premium)/.test(lower)) { updated.pricePreference = "premium"; changed = true; }
  if (/ưu tiên cân bằng/.test(lower)) { updated.pricePreference = "balanced"; changed = true; }
  // An explicit "đổi/cập nhật/đặt ..." command is the user's own entry, so it is recorded as confirmed.
  return changed ? stampChanges(profile, updated, "user_entered", updated.updatedAt) : null;
}
