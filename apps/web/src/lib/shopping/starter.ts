// Cold start: "Nhà mình đang dùng gì?" — a short checklist by the children's age, so the plan page has items to
// forecast before the first purchase is logged. Tapping creates items; nothing is assumed without a tap.
import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { FamilyProfile } from "../experience/types.ts";
import type { ItemCategory, ShoppingItem } from "./items.ts";

export interface StarterItem { key: string; name: string; category: ItemCategory; unit: string; packSize?: number; childId?: string; reason: string }

/** Suggestions for the family's children (diapers under 3, milk under 2, solids 5–24 months) plus common household consumables. */
export function starterItems(profile: FamilyProfile | null, now = new Date()): StarterItem[] {
  const out: StarterItem[] = [];
  for (const child of profile?.children ?? []) {
    const age = childAgeMonths(child, now);
    const who = child.name ? `bé ${child.name}` : "bé";
    const suffix = (profile?.children.length ?? 0) > 1 ? ` (${who})` : "";
    if (age === undefined || age < 36) out.push({ key: `diapers:${child.id}`, name: `Bỉm${child.currentBrand ? ` ${child.currentBrand}` : ""}${child.diaperSize ? ` size ${child.diaperSize}` : ""}${suffix}`, category: "diapers", unit: "miếng", childId: child.id, reason: `${who} đang dùng bỉm` });
    if (age === undefined || age < 24) out.push({ key: `wipes:${child.id}`, name: `Khăn ướt${suffix}`, category: "wipes", unit: "tờ", packSize: 80, childId: child.id, reason: "dùng cùng bỉm" });
    if (age === undefined || age < 24) out.push({ key: `milk:${child.id}`, name: `Sữa công thức${suffix}`, category: "milk", unit: "hộp", packSize: 1, childId: child.id, reason: "nếu bé uống sữa công thức" });
    if (age !== undefined && age >= 5 && age < 24) out.push({ key: `solids:${child.id}`, name: `Đồ ăn dặm${suffix}`, category: "solids", unit: "gói", packSize: 1, childId: child.id, reason: `${who} đang tuổi ăn dặm` });
  }
  out.push(
    { key: "household:laundry", name: "Nước giặt", category: "household", unit: "can", packSize: 1, reason: "đồ gia đình hay mua" },
    { key: "household:toilet-paper", name: "Giấy vệ sinh", category: "household", unit: "lốc", packSize: 1, reason: "đồ gia đình hay mua" },
    { key: "household:dish-soap", name: "Nước rửa bát", category: "household", unit: "chai", packSize: 1, reason: "đồ gia đình hay mua" },
  );
  return out;
}

export const itemFromStarter = (starter: StarterItem): ShoppingItem => ({ id: crypto.randomUUID(), name: starter.name, category: starter.category, unit: starter.unit, packSize: starter.packSize, childId: starter.childId, status: "active" });
