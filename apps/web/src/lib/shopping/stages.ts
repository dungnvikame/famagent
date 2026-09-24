// "Sắp tới theo giai đoạn của bé" (phase 3): needs that come with age and weight — a Babylist-style checklist, not a
// shop. Ranges are common guidance; diaper sizes differ by brand, so the UI labels them "khoảng, theo bao bì".
import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { FamilyProfile } from "../experience/types.ts";
import type { PlanEntry } from "./plan.ts";

export interface StageSuggestion { key: string; childId: string; title: string; detail: string; when: string }

/** Common upper weight (kg) per diaper size, in order. */
export const DIAPER_SIZES: Array<{ size: string; upTo: number }> = [
  { size: "NB", upTo: 5 }, { size: "S", upTo: 8 }, { size: "M", upTo: 11 }, { size: "L", upTo: 14 }, { size: "XL", upTo: 17 }, { size: "XXL", upTo: 25 },
];
/** Within this many kg of the size's upper weight, suggest the next size (and not stocking up on the current one). */
export const SIZE_MARGIN_KG = 0.8;

const MILESTONES: Array<{ key: string; from: number; to: number; title: string; detail: string }> = [
  { key: "solids", from: 4, to: 6, title: "Chuẩn bị ăn dặm", detail: "Ghế ăn, bát thìa mềm, yếm. Ăn dặm thường bắt đầu khoảng 6 tháng (khuyến nghị WHO)." },
  { key: "sippy", from: 5, to: 8, title: "Cốc hoặc bình tập uống", detail: "Tập uống nước bằng cốc khi bắt đầu ăn dặm." },
  { key: "car-seat", from: 9, to: 15, title: "Xem lại ghế ô tô", detail: "Nhiều bé chuyển sang ghế lớn hơn quanh 9–18 kg — kiểm tra giới hạn cân của ghế đang dùng." },
  { key: "walking-shoes", from: 9, to: 13, title: "Giày tập đi", detail: "Giày đế mềm khi bé bắt đầu đứng vững và tập đi." },
  { key: "milk-switch", from: 11, to: 13, title: "Đổi loại sữa sau 12 tháng", detail: "Hỏi bác sĩ về loại sữa phù hợp sau 1 tuổi; tránh tích trữ nhiều sữa số đang dùng." },
  { key: "potty", from: 18, to: 30, title: "Bô và quần tập bỏ bỉm", detail: "Nhiều bé sẵn sàng tập bỏ bỉm trong khoảng 18–30 tháng." },
];

/** Suggestions for each child now (milestones about a month early), minus those the family marked "Đã có" or hid. */
export function upcomingStages(profile: FamilyProfile | null, entries: PlanEntry[], now = new Date(), month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`): StageSuggestion[] {
  const settled = new Set(entries.filter((entry) => entry.stageKey && entry.status !== "planned").map((entry) => entry.stageKey!));
  const planned = new Set(entries.filter((entry) => entry.stageKey && entry.status === "planned" && entry.month === month).map((entry) => entry.stageKey!));
  const out: StageSuggestion[] = [];
  for (const child of profile?.children ?? []) {
    const who = child.name ? `bé ${child.name}` : "bé";
    const age = childAgeMonths(child, now);
    const current = DIAPER_SIZES.findIndex((entry) => entry.size === child.diaperSize?.toUpperCase());
    if (child.weightKg !== undefined && current >= 0 && current < DIAPER_SIZES.length - 1 && child.weightKg >= DIAPER_SIZES[current].upTo - SIZE_MARGIN_KG) {
      const next = DIAPER_SIZES[current + 1].size;
      out.push({ key: `stage:size-${next}:${child.id}`, childId: child.id, title: `${who} sắp lên bỉm size ${next}`, detail: `${who} ${`${child.weightKg}`.replace(".", ",")} kg, gần trần size ${child.diaperSize} (~${DIAPER_SIZES[current].upTo} kg, khoảng theo bao bì). Đừng tích trữ size ${child.diaperSize}.`, when: "sắp tới" });
    }
    if (age === undefined) continue;
    for (const milestone of MILESTONES) {
      if (age < milestone.from - 1 || age > milestone.to) continue;
      out.push({ key: `stage:${milestone.key}:${child.id}`, childId: child.id, title: milestone.title, detail: `${who}: ${milestone.detail}`, when: age < milestone.from ? `khoảng ${milestone.from} tháng` : "bây giờ" });
    }
  }
  return out.filter((stage) => !settled.has(stage.key)).map((stage) => planned.has(stage.key) ? { ...stage, when: `${stage.when} · đã có trong kế hoạch` } : stage);
}
