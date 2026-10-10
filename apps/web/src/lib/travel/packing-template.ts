// "Gợi ý theo nhà mình": a rule-based packing checklist from the trip (kind × nights) and the family profile
// (each child's age) — the sources behind the rules are in plan 261010-1335 §2 (MoMo/mytour/VnExpress/mia.vn
// family-travel checklists). Pure and deterministic; the UI always shows a confirm list before adding anything.
import type { TripMember } from "./trip-members.ts";
import type { DestType, PackingCategory, PackingItem } from "./types.ts";

export interface PackingSuggestion { name: string; qty: number; category: PackingCategory; memberId?: string }

const norm = (value: string) => value.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
/** First word-ish key of a name ("Bỉm size M ×24" → "bỉm size m") so an existing item hides the matching suggestion. */
const key = (value: string) => norm(value).replace(/[×x]\s*\d+.*$/, "").split(/[·(,]/)[0].trim();
/** "Na (4 tuổi)" → "Na". */
const childName = (label: string) => label.replace(/\s*\(.*\)$/, "");

export function suggestPacking(input: { destType: DestType; nights: number; members: TripMember[]; existing: Pick<PackingItem, "name">[] }): PackingSuggestion[] {
  const { destType, members } = input;
  const nights = Math.max(0, Math.min(30, input.nights));
  const days = nights + 1;
  const children = members.filter((member) => member.kind === "child");
  const youngest = Math.min(...children.map((child) => child.ageMonths ?? 120), 999);
  const out: PackingSuggestion[] = [];
  const add = (name: string, category: PackingCategory, qty = 1, memberId?: string) => out.push({ name, qty: Math.max(1, Math.min(99, qty)), category, memberId });

  // Giấy tờ — khai sinh chứng minh quan hệ khi bay/trong nước; hộ chiếu khi ra nước ngoài.
  add("CCCD bố mẹ", "documents");
  if (destType === "abroad") add("Hộ chiếu cả nhà (kiểm tra hạn ≥ 6 tháng)", "documents");
  for (const child of children) {
    add(`Giấy khai sinh ${childName(child.label)}`, "documents");
    add(`Thẻ BHYT ${childName(child.label)}`, "documents");
  }

  // Quần áo — mỗi bé ≥ 1 bộ/ngày + dự phòng; người lớn tự ước theo số ngày.
  for (const child of children) add(`Quần áo ${childName(child.label)}`, "clothes", Math.min(14, days + ((child.ageMonths ?? 48) < 36 ? 2 : 1)));
  add("Quần áo người lớn", "clothes", Math.min(10, days));
  add("Mũ/nón cả nhà", "clothes");

  // Đồ bé theo tuổi.
  for (const child of children) {
    const name = childName(child.label);
    const months = child.ageMonths ?? 48;
    if (months < 36) {
      add(`Bỉm ${name}`, "kids", Math.min(99, days * 6));
      add(`Sữa + bình sữa ${name}`, "kids");
      add("Khăn ướt", "kids", Math.min(10, Math.ceil(days / 2)));
    }
    if (months >= 6 && months < 30) add(`Đồ ăn dặm/cháo gói ${name}`, "kids", days);
    if (months < 24) add("Xe đẩy gấp gọn / địu", "kids");
    if (months >= 12 && months < 84) add(`Gối + thú bông quen thuộc của ${name}`, "kids");
  }
  if (children.length) {
    add("Đồ chơi nhỏ + sách cho đường đi", "kids");
    add("Giấy ghi tên + SĐT bố mẹ bỏ túi bé (phòng đi lạc)", "other");
    add("Túi nhỏ lấy nhanh khi di chuyển (bỉm, khăn, đồ ăn vặt)", "other");
  }

  // Thuốc & y tế — tủ thuốc du lịch cho nhà có trẻ.
  if (children.length) {
    add("Thuốc hạ sốt + miếng dán hạ sốt", "health");
    add("Men tiêu hoá, oresol", "health");
  }
  add("Băng gạc, urgo, thuốc cá nhân đang dùng", "health");
  add("Xịt chống muỗi" + (children.length ? " loại cho trẻ em" : ""), "health");
  if (destType === "beach" || destType === "abroad") add("Kem chống nắng" + (children.length ? " trẻ em" : ""), "health");
  if (destType === "hometown" || destType === "mountain") add("Thuốc say xe", "health");

  // Điện tử & tiền.
  add("Sạc điện thoại + sạc dự phòng", "electronics");
  if (destType === "abroad") { add("Ổ cắm chuyển đổi", "electronics"); add("Sim/eSIM data nước đến", "electronics"); add("Đổi tiền / thẻ thanh toán quốc tế", "other"); }

  // Theo điểm đến.
  if (destType === "beach") {
    for (const child of children) add(`Đồ bơi + phao ${childName(child.label)}`, "clothes");
    add("Đồ bơi người lớn", "clothes");
    add("Áo chống nắng dài tay", "clothes");
    add("Dép/sandal đi biển", "clothes");
  }
  if (destType === "mountain") { add("Áo khoác ấm", "clothes"); add("Giày thể thao bám tốt", "clothes"); add("Áo mưa mỏng", "clothes"); }
  if (destType === "city") { add("Giày thoải mái đi bộ", "clothes"); add("Ô gấp", "other"); }
  if (destType === "hometown") add("Quà cho ông bà hai bên", "other");

  // Đồ ăn đường đi.
  add("Đồ ăn vặt + bình nước cho đường đi", "food");
  if (youngest < 36) add("Máy hâm sữa mini / bình giữ nhiệt", "kids");

  // Một món đã có trong checklist thì không gợi ý lại: "Bỉm Bin size M ×10" che "Bỉm Bin" (khớp tiền tố hai chiều).
  const existingKeys = input.existing.map((item) => key(item.name)).filter(Boolean);
  const seen = new Set<string>();
  return out.filter((suggestion) => {
    const k = key(suggestion.name);
    if (seen.has(k) || existingKeys.some((taken) => taken.startsWith(k) || k.startsWith(taken))) return false;
    seen.add(k);
    return true;
  });
}
