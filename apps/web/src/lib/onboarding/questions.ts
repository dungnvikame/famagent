// Multiple-choice onboarding (tap, don't type): each question reads its current answer from the profile and
// applies a new one. Pure so the flow is unit-tested; the wizard component only renders and persists.
import type { ChildProfile, FamilyProfile, Sensitivity, ShoppingConcern } from "../experience/types.ts";

export type QuestionGroup = "Gia đình" | "Về bé" | "Chăm sóc" | "Ưu tiên" | "Nhà mình";
export interface Choice { value: string; label: string; hint?: string }
export interface Question {
  /** Stable id, also recorded in profile.onboarding (≤ 80 chars). */
  id: string;
  group: QuestionGroup;
  title: string;
  help?: string;
  mode: "single" | "multi" | "text";
  choices: Choice[];
  /** Weight questions also accept an exact number. */
  exact?: { min: number; max: number; step: number; unit: string };
  current: (profile: FamilyProfile) => string[];
  apply: (profile: FamilyProfile, values: string[]) => FamilyProfile;
}

export const AGE_CHOICES: Array<Choice & { months: number }> = [
  { value: "0-3", label: "Dưới 3 tháng", months: 1 },
  { value: "3-6", label: "3–6 tháng", months: 4 },
  { value: "6-12", label: "6–12 tháng", months: 9 },
  { value: "12-24", label: "1–2 tuổi", months: 18 },
  { value: "24-36", label: "2–3 tuổi", months: 30 },
  { value: "36+", label: "Trên 3 tuổi", months: 42 },
];
/** Stored as the range midpoint: the hard filter needs a number; the UI always shows the range. */
export const WEIGHT_CHOICES: Array<Choice & { min: number; max: number; kg: number }> = [
  { value: "<5", label: "Dưới 5 kg", hint: "thường size NB", min: 2, max: 5, kg: 4 },
  { value: "5-8", label: "5–8 kg", hint: "thường size S", min: 5, max: 8, kg: 6.5 },
  { value: "8-11", label: "8–11 kg", hint: "thường size M", min: 8, max: 11, kg: 9.5 },
  { value: "11-14", label: "11–14 kg", hint: "thường size L", min: 11, max: 14, kg: 12.5 },
  { value: "14-17", label: "14–17 kg", hint: "thường size XL", min: 14, max: 17, kg: 15.5 },
  { value: "17+", label: "Trên 17 kg", hint: "thường size XXL", min: 17, max: 30, kg: 18.5 },
];

const MONTH = 30.44 * 86_400_000;
const ageMonthsOf = (child: ChildProfile, now: number) => child.birthDate ? Math.max(0, Math.floor((now - Date.parse(`${child.birthDate}T00:00:00Z`)) / MONTH)) : child.ageMonths;
export const childTitle = (child: ChildProfile, index: number, count: number) => child.name ? `bé ${child.name}` : count > 1 ? `bé thứ ${index + 1}` : "bé";

function withChild(profile: FamilyProfile, index: number, patch: (child: ChildProfile) => ChildProfile): FamilyProfile {
  return { ...profile, children: profile.children.map((child, position) => position === index ? patch({ ...child }) : child) };
}

/** "8–11 kg" when the stored value is a picked range midpoint, otherwise the exact number ("10,5 kg"). */
export function formatWeight(kg: number): string {
  return WEIGHT_CHOICES.find((choice) => choice.kg === kg)?.label ?? `${kg.toLocaleString("vi-VN")} kg`;
}

export function weightChoiceFor(kg: number | undefined): string | undefined {
  if (kg === undefined) return undefined;
  return WEIGHT_CHOICES.find((choice) => kg >= choice.min && kg < choice.max)?.value ?? (kg >= 17 ? "17+" : "<5");
}

/** Ordered questions for the current profile; child questions repeat for each child (max 3). */
export function buildQuestions(profile: FamilyProfile, newId: () => string = () => crypto.randomUUID(), now = Date.now()): Question[] {
  const questions: Question[] = [
    {
      id: "adults", group: "Gia đình", title: "Nhà mình có mấy người lớn?", mode: "single",
      choices: [{ value: "1", label: "1 người" }, { value: "2", label: "2 người" }, { value: "3", label: "3 người" }, { value: "4", label: "4 người trở lên" }],
      current: (p) => p.adultsCount ? [String(Math.min(p.adultsCount, 4))] : [],
      apply: (p, [value]) => ({ ...p, adultsCount: Number(value) }),
    },
    {
      id: "kids", group: "Gia đình", title: "Có mấy bé đang dùng bỉm?", help: "Mình sẽ hỏi riêng từng bé để gợi ý đúng size.", mode: "single",
      choices: [{ value: "1", label: "1 bé" }, { value: "2", label: "2 bé" }, { value: "3", label: "3 bé" }],
      current: (p) => p.children.length ? [String(Math.min(p.children.length, 3))] : [],
      apply: (p, [value]) => {
        const count = Number(value);
        const children = p.children.slice(0, count);
        while (children.length < count) children.push({ id: newId() });
        return { ...p, children };
      },
    },
  ];
  const count = Math.min(profile.children.length, 3);
  for (let index = 0; index < count; index++) {
    const child = profile.children[index];
    const who = childTitle(child, index, count);
    const suffix = child.id;
    questions.push(
      {
        id: `child-name:${suffix}`, group: "Về bé", title: count > 1 ? `Bé thứ ${index + 1} tên gì?` : "Bé tên gì?", help: "Không bắt buộc — chỉ để mình gọi cho thân thiện.", mode: "text", choices: [],
        current: (p) => p.children[index]?.name ? [p.children[index].name!] : [],
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, name: value?.trim().slice(0, 80) || undefined })),
      },
      {
        id: `child-age:${suffix}`, group: "Về bé", title: `${who[0].toUpperCase()}${who.slice(1)} bao nhiêu tuổi?`, mode: "single", choices: AGE_CHOICES,
        current: (p) => {
          const months = p.children[index] ? ageMonthsOf(p.children[index], now) : undefined;
          if (months === undefined) return [];
          const match = [...AGE_CHOICES].reverse().find((choice) => months >= Number(choice.value.split(/[-+]/)[0]));
          return match ? [match.value] : [];
        },
        // A picked age range replaces a stored birth date (the two must not disagree).
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, ageMonths: AGE_CHOICES.find((choice) => choice.value === value)?.months, birthDate: undefined })),
      },
      {
        id: `child-weight:${suffix}`, group: "Về bé", title: `${who[0].toUpperCase()}${who.slice(1)} nặng khoảng bao nhiêu?`, help: "Cân nặng quyết định size bỉm — chọn khoảng gần nhất là đủ.", mode: "single", choices: WEIGHT_CHOICES,
        exact: { min: 2, max: 30, step: 0.1, unit: "kg" },
        current: (p) => { const choice = weightChoiceFor(p.children[index]?.weightKg); return choice ? [choice] : []; },
        apply: (p, [value]) => {
          const exact = Number(value);
          const kg = Number.isFinite(exact) && exact >= 2 && exact <= 30 ? Math.round(exact * 10) / 10 : WEIGHT_CHOICES.find((choice) => choice.value === value)?.kg;
          // A new weight makes an old size answer stale (the recommender derives fit from weight): drop it.
          return withChild(p, index, (c) => ({ ...c, weightKg: kg, diaperSize: c.weightKg === kg ? c.diaperSize : undefined }));
        },
      },
      {
        id: `child-care:${suffix}`, group: "Chăm sóc", title: `Khi chọn bỉm cho ${who}, cần lưu ý gì?`, help: "Chọn tất cả điều đúng với bé.", mode: "multi",
        choices: [{ value: "sensitive_skin", label: "Da nhạy cảm" }, { value: "rash_prone", label: "Dễ bị hăm" }, { value: "fragrance_free", label: "Cần loại không mùi" }, { value: "none", label: "Không có gì đặc biệt" }],
        current: (p) => { const list = p.children[index]?.sensitivities; return list === undefined ? [] : list.length ? [...list] : ["none"]; },
        apply: (p, values) => withChild(p, index, (c) => ({ ...c, sensitivities: values.filter((value): value is Sensitivity => value !== "none") })),
      },
    );
  }
  questions.push(
    {
      id: "concern", group: "Ưu tiên", title: "Điều quan trọng nhất khi chọn bỉm?", mode: "single",
      choices: [{ value: "night", label: "Dùng ban đêm", hint: "ngủ ngon, không tràn" }, { value: "leak", label: "Hạn chế tràn", hint: "thấm hút tốt" }, { value: "soft", label: "Mỏng nhẹ, thoáng" }, { value: "sensitive", label: "Dịu nhẹ cho da" }, { value: "value", label: "Giá tốt theo miếng" }],
      current: (p) => p.mainConcern ? [p.mainConcern] : [],
      apply: (p, [value]) => ({ ...p, mainConcern: value as ShoppingConcern }),
    },
    {
      id: "budget", group: "Ưu tiên", title: "Bạn thường chi tối đa bao nhiêu cho một gói bỉm?", mode: "single",
      choices: [{ value: "250000", label: "Dưới 250k" }, { value: "350000", label: "250–350k" }, { value: "450000", label: "350–450k" }, { value: "none", label: "Không giới hạn" }],
      current: (p) => p.maxBudget ? [["250000", "350000", "450000"].find((value) => p.maxBudget! <= Number(value)) ?? "450000"] : [],
      apply: (p, [value]) => ({ ...p, maxBudget: value === "none" ? undefined : Number(value) }),
    },
    {
      id: "price", group: "Ưu tiên", title: "Khi chọn giữa các lựa chọn phù hợp, bạn nghiêng về?", mode: "single",
      choices: [{ value: "budget", label: "Tiết kiệm nhất" }, { value: "balanced", label: "Cân bằng giá và chất lượng" }, { value: "premium", label: "Chất lượng cao cấp" }],
      current: (p) => p.fieldMeta?.pricePreference ? [p.pricePreference] : [],
      apply: (p, [value]) => ({ ...p, pricePreference: value as FamilyProfile["pricePreference"] }),
    },
    {
      id: "washer", group: "Nhà mình", title: "Nhà mình dùng máy giặt loại nào?", help: "Để sau này gợi ý nước giặt, nước xả phù hợp.", mode: "single",
      choices: [{ value: "front", label: "Cửa trước" }, { value: "top", label: "Cửa trên" }, { value: "none", label: "Không dùng máy giặt" }],
      current: (p) => p.appliances?.washingMachine ? [p.appliances.washingMachine] : [],
      apply: (p, [value]) => ({ ...p, appliances: { washingMachine: value as "front" | "top" | "none" } }),
    },
  );
  return questions;
}

/** Records answered/skipped ids (profile.onboarding v2) so analytics and resume see the same state. */
export function markQuestion(profile: FamilyProfile, id: string, skipped: boolean): FamilyProfile {
  const state = profile.onboarding ?? { version: 2 as const, completedSlots: [], skippedSlots: [] };
  const completed = state.completedSlots.filter((slot) => slot !== id);
  const skippedList = state.skippedSlots.filter((slot) => slot !== id);
  (skipped ? skippedList : completed).push(id);
  return { ...profile, onboarding: { version: 2, completedSlots: completed.slice(-30), skippedSlots: skippedList.slice(-30) } };
}
