// Multiple-choice onboarding (tap, don't type): each question reads its current answer from the profile and
// applies a new one. Pure so the flow is unit-tested; the wizard component only renders and persists.
import { HOUSEHOLD_FOCUS, HOUSEHOLD_SETUPS, HOUSING_TYPES, SAVING_GOALS, type ChildProfile, type FamilyProfile, type HouseholdContext, type Sensitivity } from "../experience/types.ts";

export type QuestionGroup = "Mục tiêu" | "Gia đình" | "Các con" | "Nhà ở" | "Tiền";
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

/** Child age bands for the whole childhood (not only infants); stored as the band midpoint in months. */
export const AGE_CHOICES: Array<Choice & { months: number }> = [
  { value: "0-12", label: "Dưới 1 tuổi", months: 6 },
  { value: "12-36", label: "1–3 tuổi", months: 24 },
  { value: "36-72", label: "3–6 tuổi", months: 54 },
  { value: "72-144", label: "6–12 tuổi", months: 108 },
  { value: "144+", label: "Trên 12 tuổi", months: 168 },
];
/** Stored as the range midpoint; the UI always shows the range. Asked only for children under 6. */
export const WEIGHT_CHOICES: Array<Choice & { min: number; max: number; kg: number }> = [
  { value: "<5", label: "Dưới 5 kg", min: 2, max: 5, kg: 4 },
  { value: "5-8", label: "5–8 kg", min: 5, max: 8, kg: 6.5 },
  { value: "8-11", label: "8–11 kg", min: 8, max: 11, kg: 9.5 },
  { value: "11-14", label: "11–14 kg", min: 11, max: 14, kg: 12.5 },
  { value: "14-17", label: "14–17 kg", min: 14, max: 17, kg: 15.5 },
  { value: "17+", label: "Trên 17 kg", min: 17, max: 30, kg: 18.5 },
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

/** Monthly money bands (VND), stored as a round figure. */
const band = (list: Array<[number, string]>) => list.map(([amount, label]) => ({ value: String(amount), label, amount }));
export const SPEND_CHOICES = band([[8_000_000, "Dưới 10 triệu"], [15_000_000, "10–20 triệu"], [25_000_000, "20–30 triệu"], [40_000_000, "30–50 triệu"], [60_000_000, "Trên 50 triệu"]]);
export const INCOME_CHOICES = band([[12_000_000, "Dưới 15 triệu"], [22_000_000, "15–30 triệu"], [40_000_000, "30–50 triệu"], [75_000_000, "50–100 triệu"], [120_000_000, "Trên 100 triệu"]]);
const SETUP_ADULTS: Record<NonNullable<HouseholdContext["setup"]>, number> = { couple: 2, single_parent: 1, multigen: 4, expecting: 2, no_kids: 2 };
const household = (p: FamilyProfile, patch: Partial<HouseholdContext>): FamilyProfile => ({ ...p, household: { ...p.household, ...patch } });
const pick = <T extends string>(list: readonly T[], values: string[]) => values.filter((value): value is T => (list as readonly string[]).includes(value));
const nearest = (choices: Array<{ value: string; amount: number }>, amount?: number) => amount ? [choices.reduce((best, choice) => Math.abs(choice.amount - amount) < Math.abs(best.amount - amount) ? choice : best).value] : [];
const HAS_KIDS = (p: FamilyProfile) => p.household?.setup !== "expecting" && p.household?.setup !== "no_kids";

/**
 * Onboarding v4 — general family information only (no products): what the family wants help with, who lives in
 * the house, each child (name, age, weight when under 6, health notes), housing, income, spend, saving goals.
 * Everything is skippable; families without children skip the child block.
 */
export function buildQuestions(profile: FamilyProfile, newId: () => string = () => crypto.randomUUID(), now = Date.now()): Question[] {
  const questions: Question[] = [
    {
      id: "focus", group: "Mục tiêu", title: "Bạn muốn FamAgent đỡ việc gì cho nhà mình?", help: "Chọn một hoặc vài việc — mình sẽ ưu tiên những việc này trên Trang chủ.", mode: "multi",
      choices: [
        { value: "money", label: "Quản lý thu chi hằng tháng", hint: "biết tiền đi đâu, còn tiêu được bao nhiêu" },
        { value: "shopping", label: "Mua sắm cho gia đình hợp lý hơn", hint: "chọn đúng, không mua thừa" },
        { value: "replenish", label: "Nhắc những thứ dễ quên", hint: "đồ dùng sắp hết, hóa đơn đến hạn" },
        { value: "care", label: "Theo dõi sức khỏe, thói quen của các con", hint: "dị ứng, cân nặng, điều cần tránh" },
      ],
      current: (p) => p.household?.focus ? [...p.household.focus] : [],
      apply: (p, values) => household(p, { focus: pick(HOUSEHOLD_FOCUS, values) }),
    },
    {
      id: "setup", group: "Gia đình", title: "Nhà mình hiện thế nào?", help: "Để mình hiểu quy mô gia đình khi tính chi tiêu và nhắc việc.", mode: "single",
      choices: [
        { value: "couple", label: "Vợ chồng và các con" },
        { value: "multigen", label: "Sống cùng ông bà", hint: "3 thế hệ" },
        { value: "single_parent", label: "Mình tự nuôi con" },
        { value: "expecting", label: "Đang chờ em bé chào đời" },
        { value: "no_kids", label: "Chưa có con" },
      ],
      current: (p) => p.household?.setup ? [p.household.setup] : [],
      apply: (p, [value]) => {
        const setup = pick(HOUSEHOLD_SETUPS, [value])[0];
        if (!setup) return p;
        const next = { ...household(p, { setup }), adultsCount: SETUP_ADULTS[setup] };
        return setup === "expecting" || setup === "no_kids" ? { ...next, children: [] } : next;
      },
    },
  ];
  if (HAS_KIDS(profile)) questions.push({
    id: "kids", group: "Gia đình", title: "Nhà mình có mấy con?", help: "Mình sẽ hỏi vài điều cơ bản về từng con.", mode: "single",
    choices: [{ value: "1", label: "1 con" }, { value: "2", label: "2 con" }, { value: "3", label: "3 con trở lên" }],
    current: (p) => p.children.length ? [String(Math.min(p.children.length, 3))] : [],
    apply: (p, [value]) => {
      const count = Number(value);
      const children = p.children.slice(0, count);
      while (children.length < count) children.push({ id: newId() });
      return { ...p, children };
    },
  });
  const count = HAS_KIDS(profile) ? Math.min(profile.children.length, 3) : 0;
  for (let index = 0; index < count; index++) {
    const child = profile.children[index];
    const who = childTitle(child, index, count);
    const Who = `${who[0].toUpperCase()}${who.slice(1)}`;
    const suffix = child.id;
    const months = ageMonthsOf(child, now);
    questions.push(
      {
        id: `child-name:${suffix}`, group: "Các con", title: count > 1 ? `Con thứ ${index + 1} tên ở nhà là gì?` : "Con tên ở nhà là gì?", help: "Để mình gọi cho thân — tên chỉ lưu trong tài khoản của bạn, không gửi cho AI.", mode: "text", choices: [],
        current: (p) => p.children[index]?.name ? [p.children[index].name!] : [],
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, name: value?.trim().slice(0, 80) || undefined })),
      },
      {
        id: `child-age:${suffix}`, group: "Các con", title: `${Who} bao nhiêu tuổi?`, mode: "single", choices: AGE_CHOICES,
        current: (p) => {
          const value = p.children[index] ? ageMonthsOf(p.children[index], now) : undefined;
          if (value === undefined) return [];
          const match = [...AGE_CHOICES].reverse().find((choice) => value >= Number(choice.value.split(/[-+]/)[0]));
          return match ? [match.value] : [];
        },
        // A picked age range replaces a stored birth date (the two must not disagree).
        apply: (p, [value]) => withChild(p, index, (c) => ({ ...c, ageMonths: AGE_CHOICES.find((choice) => choice.value === value)?.months, birthDate: undefined })),
      },
    );
    // Weight matters for small children (growth, sizes); skip it once they are 6+.
    if (months === undefined || months < 72) questions.push({
      id: `child-weight:${suffix}`, group: "Các con", title: `${Who} nặng khoảng bao nhiêu?`, help: "Chọn khoảng gần nhất, hoặc nhập số chính xác. Mình sẽ nhắc cập nhật khi con lớn.", mode: "single", choices: WEIGHT_CHOICES,
      exact: { min: 2, max: 30, step: 0.1, unit: "kg" },
      current: (p) => { const choice = weightChoiceFor(p.children[index]?.weightKg); return choice ? [choice] : []; },
      apply: (p, [value]) => {
        const exact = Number(value);
        const kg = Number.isFinite(exact) && exact >= 2 && exact <= 30 ? Math.round(exact * 10) / 10 : WEIGHT_CHOICES.find((choice) => choice.value === value)?.kg;
        return withChild(p, index, (c) => ({ ...c, weightKg: kg, diaperSize: c.weightKg === kg ? c.diaperSize : undefined }));
      },
    });
    questions.push({
      id: `child-care:${suffix}`, group: "Các con", title: `${Who} có điều gì cần lưu ý về sức khỏe?`, help: "Chọn tất cả điều đúng — mình sẽ nhớ và tránh những thứ không hợp với con.", mode: "multi",
      choices: [{ value: "sensitive_skin", label: "Da nhạy cảm" }, { value: "rash_prone", label: "Hay bị hăm, mẩn ngứa" }, { value: "fragrance_free", label: "Dị ứng mùi hương, hóa chất" }, { value: "none", label: "Không có gì đặc biệt" }],
      current: (p) => { const list = p.children[index]?.sensitivities; return list === undefined ? [] : list.length ? [...list] : ["none"]; },
      apply: (p, values) => withChild(p, index, (c) => ({ ...c, sensitivities: values.filter((value): value is Sensitivity => value !== "none") })),
    });
  }
  questions.push(
    {
      id: "housing", group: "Nhà ở", title: "Nhà mình đang ở thế nào?", help: "Nếu thuê nhà, mình sẽ gợi ý đặt tiền nhà thành khoản cố định hằng tháng.", mode: "single",
      choices: [{ value: "own", label: "Nhà của mình" }, { value: "rent", label: "Thuê nhà" }, { value: "with_parents", label: "Ở cùng bố mẹ" }],
      current: (p) => p.household?.housing ? [p.household.housing] : [],
      apply: (p, [value]) => household(p, { housing: pick(HOUSING_TYPES, [value])[0] }),
    },
    {
      id: "income", group: "Tiền", title: "Thu nhập cả nhà mỗi tháng khoảng bao nhiêu?", help: "Ước chừng là được, có thể bỏ qua. Chỉ dùng để tính tỷ lệ tiết kiệm cho bạn — không chia sẻ với ai.", mode: "single",
      choices: INCOME_CHOICES,
      current: (p) => nearest(INCOME_CHOICES, p.household?.monthlyIncome),
      apply: (p, [value]) => household(p, { monthlyIncome: INCOME_CHOICES.find((choice) => choice.value === value)?.amount }),
    },
    {
      id: "spend", group: "Tiền", title: "Mỗi tháng nhà mình tiêu khoảng bao nhiêu?", help: "Tính cả ăn uống, hóa đơn, chi cho các con. Mình dùng làm kế hoạch chi tháng để báo sớm khi tiêu quá tay; sửa lại lúc nào cũng được.", mode: "single",
      choices: SPEND_CHOICES,
      current: (p) => nearest(SPEND_CHOICES, p.household?.monthlySpend),
      apply: (p, [value]) => household(p, { monthlySpend: SPEND_CHOICES.find((choice) => choice.value === value)?.amount }),
    },
    {
      id: "goals", group: "Tiền", title: "Nhà mình đang để dành cho điều gì?", help: "Chọn tất cả điều đúng — mình sẽ giúp theo dõi tiến độ.", mode: "multi",
      choices: [
        { value: "emergency", label: "Quỹ dự phòng" }, { value: "education", label: "Học hành của các con" }, { value: "home", label: "Mua hoặc sửa nhà" },
        { value: "car", label: "Mua xe" }, { value: "travel", label: "Du lịch" }, { value: "retirement", label: "Về hưu, chăm sóc bố mẹ" },
      ],
      current: (p) => p.household?.savingGoals ? [...p.household.savingGoals] : [],
      apply: (p, values) => household(p, { savingGoals: pick(SAVING_GOALS, values) }),
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
