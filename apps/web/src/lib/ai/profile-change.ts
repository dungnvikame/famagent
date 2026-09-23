import type { FamilyProfile } from "@/lib/experience/types";
import { stampChanges } from "../experience/profile-meta.ts";

export function parseProfileChange(message: string, profile: FamilyProfile | null): FamilyProfile | null {
  if (!profile || !/(?:đổi|cập nhật|sửa|thay|hiện nặng|giờ nặng|ngân sách thành|size thành)/i.test(message)) return null;
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
  const budget = message.match(/(?:ngân sách|giới hạn giá|mức giá)\s*(?:tối đa|thành|là|dưới)?\s*(\d{2,7})\s*(k|nghìn|ngàn|triệu|đ|vnd)?/i);
  if (budget) { const base = Number(budget[1]); const amount = /triệu/i.test(budget[2] ?? "") ? base * 1_000_000 : /^(k|nghìn|ngàn)$/i.test(budget[2] ?? "") || (base < 10000 && !budget[2]) ? base * 1000 : base; if (amount >= 50_000 && amount <= 100_000_000) { updated.maxBudget = amount; changed = true; } }
  if (/ưu tiên (?:giá tốt|tiết kiệm)/.test(lower)) { updated.pricePreference = "budget"; changed = true; }
  if (/ưu tiên (?:cao cấp|premium)/.test(lower)) { updated.pricePreference = "premium"; changed = true; }
  if (/ưu tiên cân bằng/.test(lower)) { updated.pricePreference = "balanced"; changed = true; }
  // An explicit "đổi/cập nhật ..." command is the user's own entry, so it is recorded as confirmed.
  return changed ? stampChanges(profile, updated, "user_entered", updated.updatedAt) : null;
}
