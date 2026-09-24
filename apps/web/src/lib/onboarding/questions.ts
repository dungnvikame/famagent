// Multiple-choice onboarding (tap, don't type): each question reads its current answer from the profile and
// applies a new one. Pure so the flow is unit-tested; the wizard component only renders and persists.
import { HOUSEHOLD_FOCUS, HOUSEHOLD_SETUPS, MERCHANT_LABELS, MERCHANTS, type ChildProfile, type FamilyProfile, type HouseholdContext, type Sensitivity, type ShoppingConcern } from "../experience/types.ts";

export type QuestionGroup = "Mục tiêu" | "Gia đình" | "Về bé" | "Mua sắm" | "Tiền";
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

/** Current brand choices (Vietnam market leaders); "other" keeps the field empty for the chat to fill in. */
export const BRAND_CHOICES: Choice[] = [
  { value: "Bobby", label: "Bobby" }, { value: "Huggies", label: "Huggies" }, { value: "Merries", label: "Merries" }, { value: "Moony", label: "Moony" },
  { value: "Pampers", label: "Pampers" }, { value: "Goo.n", label: "Goo.n" }, { value: "other", label: "Hãng khác / chưa cố định" },
];
/** Monthly household spend bands, stored as a round plan figure (VND). */
export const SPEND_CHOICES: Array<Choice & { amount: number }> = [
  { value: "8000000", label: "Dưới 10 triệu", amount: 8_000_000 },
  { value: "15000000", label: "10–20 triệu", amount: 15_000_000 },
  { value: "25000000", label: "20–30 triệu", amount: 25_000_000 },
  { value: "40000000", label: "30–50 triệu", amount: 40_000_000 },
  { value: "60000000", label: "Trên 50 triệu", amount: 60_000_000 },
];
const SETUP_ADULTS: Record<NonNullable<HouseholdContext["setup"]>, number> = { couple: 2, single_parent: 1, multigen: 4, expecting: 2 };
const household = (p: FamilyProfile, patch: Partial<HouseholdContext>): FamilyProfile => ({ ...p, household: { ...p.household, ...patch } });

/**
 * Ordered questions (onboarding v3): start from why the family is here, then who lives in the house, then each
 * child (max 3), shopping habits and a rough monthly spend that seeds the Money plan. Every question is skippable;
 * an expecting family skips the per-child block.
 */
export function buildQuestions(profile: FamilyProfile, newId: () => string = () => crypto.randomUUID(), now = Date.now()): Question[] {
  const expecting = profile.household?.setup === "expecting";
  const questions: Question[] = [
    {
      id: "focus", group: "Mục tiêu", title: "Bạn muốn FamAgent đỡ việc gì cho nhà mình?", help: "Chọn một hoặc vài việc — mình sẽ ưu tiên những việc này trên Trang chủ.", mode: "multi",
      choices: [
        { value: "money", label: "Quản lý chi tiêu hằng tháng", hint: "biết còn tiêu được bao nhiêu" },
        { value: "shopping", label: "Chọn đồ cho con đúng và rẻ", hint: "bỉm, sữa, đồ dùng" },
        { value: "replenish", label: "Nhắc khi đồ sắp hết", hint: "không bị hết bỉm giữa đêm" },
        { value: "care", label: "Ghi nhớ sức khỏe, thói quen của bé", hint: "dị ứng, hãng hợp, lịch sinh hoạt" },
      ],
      current: (p) => p.household?.focus ? [...p.household.focus] : [],
      apply: (p, values) => household(p, { focus: values.filter((value): value is NonNullable<HouseholdContext["focus"]>[number] => (HOUSEHOLD_FOCUS as readonly string[]).includes(value)) }),
    },
    {
      id: "setup", group: "Gia đình", title: "Nhà mình hiện thế nào?", help: "Để mình tính chi tiêu và nhu cầu cho đúng quy mô.", mode: "single",
      choices: [
        { value: "couple", label: "Hai vợ chồng và con nhỏ" },
        { value: "multigen", label: "Sống cùng ông bà", hint: "3 thế hệ" },
        { value: "single_parent", label: "Mình tự chăm con" },
        { value: "expecting", label: "Đang chờ em bé chào đời" },
      ],
      current: (p) => p.household?.setup ? [p.household.setup] : [],
      apply: (p, [value]) => {
        const setup = (HOUSEHOLD_SETUPS as readonly string[]).includes(value) ? value as NonNullable<HouseholdContext["setup"]> : undefined;
        if (!setup) return p;
        return { ...household(p, { setup }), adultsCount: SETUP_ADULTS[setup], children: setup === "expecting" ? [] : p.children };
      },
    },
  ];
  if (!expecting) questions.push({
    id: "kids", group: "Gia đình", title: "Có mấy bé còn dùng bỉm, tã?", help: "Mình hỏi riêng từng bé để gợi ý đúng size.", mode: "single",
    choices: [{ value: "1", label: "1 bé" }, { value: "2", label: "2 bé" }, { value: "3", label: "3 bé" }],
    current: (p) => p.children.length ? [String(Math.min(p.children.length, 3))] : [],
    apply: (p, [value]) => {
      const count = Number(value);
      const children = p.children.slice(0, count);
      while (children.length < count) children.push({ id: newId() });
      return { ...p, children };
    },
  });
  const count = expecting ? 0 : Math.min(profile.children.length, 3);
  for (let index = 0; index < count; index++) {
    const child = profile.children[index];
    const who = childTitle(child, index, count);
    const Who = `${who[0].toUpperCase()}${who.slice(1)}`;
    const suffix = child.id;
    questions.push(
      {
        id: `child-name:${suffix}`, group: "Về bé", title: count > 1 ? `Bé thứ ${index + 1} tên ở nhà là gì?` : "Bé tên ở nhà là gì?", help: "Để mình gọi bé cho thân — tên chỉ lưu trong tài khoản của bạn, không gửi cho AI.", mode: "text", choices: [],
        current: (p) => p.children[index]?.name ? [p.children[index].name!] : [],
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, name: value?.trim().slice(0, 80) || undefined })),
      },
      {
        id: `child-age:${suffix}`, group: "Về bé", title: `${Who} được bao nhiêu tháng rồi?`, help: "Tuổi giúp mình ước lượng bé dùng bao nhiêu miếng mỗi ngày.", mode: "single", choices: AGE_CHOICES,
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
        id: `child-weight:${suffix}`, group: "Về bé", title: `${Who} nặng khoảng bao nhiêu?`, help: "Cân nặng quyết định size bỉm — chọn khoảng gần nhất, hoặc nhập số chính xác.", mode: "single", choices: WEIGHT_CHOICES,
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
        id: `child-brand:${suffix}`, group: "Về bé", title: `${Who} đang dùng bỉm hãng nào?`, help: "Mình sẽ so với hãng đang dùng và nhắc mua lại đúng loại.", mode: "single", choices: BRAND_CHOICES,
        current: (p) => { const brand = p.children[index]?.currentBrand; return brand ? [BRAND_CHOICES.some((choice) => choice.value === brand) ? brand : "other"] : []; },
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, currentBrand: value && value !== "other" ? value : undefined })),
      },
      {
        id: `child-care:${suffix}`, group: "Về bé", title: `${Who} có điều gì cần lưu ý không?`, help: "Chọn tất cả điều đúng — mình sẽ loại sản phẩm không hợp.", mode: "multi",
        choices: [{ value: "sensitive_skin", label: "Da nhạy cảm" }, { value: "rash_prone", label: "Dễ bị hăm" }, { value: "fragrance_free", label: "Cần loại không mùi" }, { value: "none", label: "Không có gì đặc biệt" }],
        current: (p) => { const list = p.children[index]?.sensitivities; return list === undefined ? [] : list.length ? [...list] : ["none"]; },
        apply: (p, values) => withChild(p, index, (c) => ({ ...c, sensitivities: values.filter((value): value is Sensitivity => value !== "none") })),
      },
    );
  }
  questions.push(
    {
      id: "concern", group: "Mua sắm", title: expecting ? "Khi chuẩn bị đồ cho bé, bạn lo nhất điều gì?" : "Khi mua bỉm, bạn lo nhất điều gì?", mode: "single",
      choices: [{ value: "night", label: "Bé ngủ đêm không bị tràn" }, { value: "sensitive", label: "Không hăm, dịu cho da" }, { value: "soft", label: "Mỏng, thoáng, bé dễ chịu" }, { value: "value", label: "Tiết kiệm — rẻ nhất tính theo miếng" }],
      current: (p) => p.mainConcern ? [p.mainConcern] : [],
      // "Tiết kiệm" also sets the ranking to best value per piece; other answers keep the balanced default.
      apply: (p, [value]) => ({ ...p, mainConcern: value as ShoppingConcern, pricePreference: value === "value" ? "value" : p.pricePreference }),
    },
    {
      id: "budget", group: "Mua sắm", title: "Một gói bỉm, bạn thấy hợp lý tối đa bao nhiêu?", help: "Mình sẽ không gợi ý gói đắt hơn mức này (bạn nới lúc nào cũng được).", mode: "single",
      choices: [{ value: "250000", label: "Dưới 250.000đ" }, { value: "350000", label: "250.000–350.000đ" }, { value: "450000", label: "350.000–450.000đ" }, { value: "none", label: "Không đặt giới hạn" }],
      current: (p) => p.maxBudget ? [["250000", "350000", "450000"].find((value) => p.maxBudget! <= Number(value)) ?? "450000"] : [],
      apply: (p, [value]) => ({ ...p, maxBudget: value === "none" ? undefined : Number(value) }),
    },
    {
      id: "merchants", group: "Mua sắm", title: "Nhà mình hay mua đồ cho bé ở đâu?", help: "Mình ưu tiên nơi bán bạn quen khi so giá.", mode: "multi",
      choices: MERCHANTS.map((value) => ({ value, label: MERCHANT_LABELS[value] })),
      current: (p) => p.household?.merchants ? [...p.household.merchants] : [],
      apply: (p, values) => household(p, { merchants: values.filter((value): value is (typeof MERCHANTS)[number] => (MERCHANTS as readonly string[]).includes(value)) }),
    },
    {
      id: "spend", group: "Tiền", title: "Mỗi tháng nhà mình tiêu khoảng bao nhiêu?", help: "Tính cả ăn uống, hóa đơn, đồ cho con — ước chừng là được. Mình dùng làm kế hoạch chi tháng để báo sớm khi tiêu quá tay; sửa lại trong mục Tiền bất cứ lúc nào.", mode: "single",
      choices: SPEND_CHOICES,
      current: (p) => { const amount = p.household?.monthlySpend; return amount ? [SPEND_CHOICES.find((choice) => choice.amount === amount)?.value ?? SPEND_CHOICES.reduce((best, choice) => Math.abs(choice.amount - amount) < Math.abs(best.amount - amount) ? choice : best).value] : []; },
      apply: (p, [value]) => household(p, { monthlySpend: SPEND_CHOICES.find((choice) => choice.value === value)?.amount }),
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
