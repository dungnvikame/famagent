// Multiple-choice onboarding (tap, don't type): each question reads its current answer from the profile and
// applies a new one. Pure so the flow is unit-tested; the wizard component only renders and persists.
import { CHECKUP_RECENCY, NUTRITION_LEVELS, PLAY_TIME, READING_FREQ, SAFETY_MEASURES, SCREEN_TIME, SLEEP_QUALITY, VACCINE_STATUS, BILL_TIMELINESS, DEBT_TYPES, INCOME_STABILITY, INSURANCE_TYPES, LONG_TERM_SAVINGS, PLANNING_LEVELS, CARE_WORRIES, EMERGENCY_LEVELS, HOUSEHOLD_FOCUS, HOUSEHOLD_STYLES, HOUSEHOLD_SETUPS, HOUSING_TYPES, MONEY_PAINS, SAVING_GOALS, TRACKING_METHODS, type ChildProfile, type FamilyProfile, type HouseholdContext, type Sensitivity } from "../experience/types.ts";

export type QuestionGroup = "Mục tiêu" | "Gia đình" | "Các con" | "Nhà ở" | "Tiền" | "Phân tích";
/**
 * core = the 4-step onboarding (nhà mình · thành viên · ưu tiên · phong cách); money / care = the deeper parts the family
 * opens later from a starter card ("Thêm tình hình tài chính"); all = every question (tests, profile update).
 */
export type QuestionSection = "all" | "core" | "money" | "care";
const CORE = /^(setup|kids|child-name:|child-age:|child-weight:|focus|style)/;
const CARE = /^(child-care:|care-worry|care-deep|vaccines|checkup|nutrition|sleep|play|screen|reading|safety)/;
/** Style → how prices are weighed when ranking (pricePreference). */
const STYLE_PRICE = { saving: "budget", balanced: "balanced", convenience: "value" } as const;
export interface Choice { value: string; label: string; hint?: string }
export interface Question {
  /** Stable id, also recorded in profile.onboarding (≤ 80 chars). */
  id: string;
  group: QuestionGroup;
  title: string;
  help?: string;
  mode: "single" | "multi" | "text";
  choices: Choice[];
  /** Shows a "Khác — tự nhập" option; the typed text is stored in household.notes[id] and passed as `other:<text>`. */
  other?: { placeholder: string };
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
export const DEBT_CHOICES = band([[0, "Không có khoản nào"], [3_000_000, "Dưới 5 triệu"], [10_000_000, "5–15 triệu"], [20_000_000, "Trên 15 triệu"]]);
const SETUP_ADULTS: Record<NonNullable<HouseholdContext["setup"]>, number> = { couple: 2, single_parent: 1, multigen: 4, expecting: 2, no_kids: 2 };
const household = (p: FamilyProfile, patch: Partial<HouseholdContext>): FamilyProfile => ({ ...p, household: { ...p.household, ...patch } });
const pick = <T extends string>(list: readonly T[], values: string[]) => values.filter((value): value is T => (list as readonly string[]).includes(value));
const nearest = (choices: Array<{ value: string; amount: number }>, amount?: number) => amount === undefined ? [] : [choices.reduce((best, choice) => Math.abs(choice.amount - amount) < Math.abs(best.amount - amount) ? choice : best).value];
const HAS_KIDS = (p: FamilyProfile) => p.household?.setup !== "expecting" && p.household?.setup !== "no_kids";
export const OTHER_PREFIX = "other:";

/** Adds the free-text "Khác" answer to a question: stored in household.notes[id], read back as `other:<text>`. */
function withOther(question: Question): Question {
  if (!question.other) return question;
  return {
    ...question,
    current: (p) => { const note = p.household?.notes?.[question.id]; return [...question.current(p), ...(note ? [OTHER_PREFIX + note] : [])]; },
    apply: (p, values) => {
      const typed = values.find((value) => value.startsWith(OTHER_PREFIX))?.slice(OTHER_PREFIX.length).trim().slice(0, 120);
      const known = values.filter((value) => !value.startsWith(OTHER_PREFIX));
      const applied = known.length || question.mode === "multi" ? question.apply(p, known) : p;
      const notes = { ...applied.household?.notes };
      if (typed) notes[question.id] = typed; else delete notes[question.id];
      return household(applied, { notes: Object.keys(notes).length ? notes : undefined });
    },
  };
}

/**
 * Onboarding v5 — family insight that drives the first assessment (no products): what the family wants help with,
 * household, each child, what worries them about raising the kids, housing, income/spend/debt/buffer, how they track
 * money today, what hurts, and what they save for. Every question is skippable; many accept a typed "Khác" answer.
 */
export function buildQuestions(profile: FamilyProfile, newId: () => string = () => crypto.randomUUID(), now = Date.now(), section: QuestionSection = "all"): Question[] {
  const kids = HAS_KIDS(profile);
  const expecting = profile.household?.setup === "expecting";
  const questions: Question[] = [
    {
      id: "focus", group: "Mục tiêu", title: "Bạn muốn FamAgent đỡ việc gì cho nhà mình?", help: "Chọn một hoặc vài việc — mình sẽ đề xuất kế hoạch xoay quanh những việc này.", mode: "multi", other: { placeholder: "Ví dụ: lên kế hoạch cho con đi học" },
      choices: [
        { value: "money", label: "Quản lý tiền", hint: "biết tiền đi đâu, còn tiêu được bao nhiêu" },
        { value: "shopping", label: "Quản lý mua sắm", hint: "mua đúng, không thừa, biết khi nào cần mua" },
        { value: "replenish", label: "Giảm việc phải nhớ", hint: "FamAgent nhắc đồ sắp hết, hóa đơn đến hạn" },
      ],
      current: (p) => p.household?.focus ? [...p.household.focus] : [],
      apply: (p, values) => household(p, { focus: pick(HOUSEHOLD_FOCUS, values) }),
    },
    {
      id: "setup", group: "Gia đình", title: "Nhà mình hiện thế nào?", help: "Để mình hiểu quy mô gia đình khi tính chi tiêu và kế hoạch.", mode: "single",
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
  if (kids) questions.push({
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
  const count = kids ? Math.min(profile.children.length, 3) : 0;
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
    // Weight matters for small children (growth); skip it once they are 6+.
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
      id: `child-care:${suffix}`, group: "Các con", title: `${Who} có điều gì cần lưu ý về sức khỏe?`, help: "Chọn tất cả điều đúng — mình sẽ nhớ và tránh những thứ không hợp với con.", mode: "multi", other: { placeholder: "Ví dụ: dị ứng đạm sữa bò, hay viêm họng" },
      choices: [{ value: "sensitive_skin", label: "Da nhạy cảm" }, { value: "rash_prone", label: "Hay bị hăm, mẩn ngứa" }, { value: "fragrance_free", label: "Dị ứng mùi hương, hóa chất" }, { value: "none", label: "Không có gì đặc biệt" }],
      current: (p) => { const list = p.children[index]?.sensitivities; return list === undefined ? [] : list.length ? [...list] : ["none"]; },
      apply: (p, values) => withChild(p, index, (c) => ({ ...c, sensitivities: values.filter((value): value is Sensitivity => value !== "none") })),
    });
  }
  if (kids || expecting) questions.push({
    id: "care-worry", group: "Các con", title: expecting ? "Chuẩn bị đón em bé, bạn đang bận tâm điều gì?" : "Chăm con lúc này, bạn bận tâm điều gì nhất?", help: "Chọn tất cả điều đúng — mình sẽ đưa vào kế hoạch chăm sóc.", mode: "multi", other: { placeholder: "Ví dụ: con biếng ăn, chưa chọn được trường" },
    choices: expecting
      ? [{ value: "birth_prep", label: "Chi phí sinh và 6 tháng đầu" }, { value: "health", label: "Sức khỏe mẹ và bé, lịch khám" }, { value: "caregiver", label: "Sắp xếp người chăm khi đi làm lại" }]
      : [{ value: "nutrition", label: "Ăn uống, dinh dưỡng" }, { value: "sleep", label: "Giấc ngủ" }, { value: "health", label: "Sức khỏe, tiêm chủng" }, { value: "development", label: "Học hành, phát triển" }, { value: "cost", label: "Chi phí nuôi con ngày càng tăng" }],
    current: (p) => p.household?.careWorries ? [...p.household.careWorries] : [],
    apply: (p, values) => household(p, { careWorries: pick(CARE_WORRIES, values) }),
  });
  if (kids) {
    const single = <T extends string>(id: string, title: string, list: readonly T[], choices: Array<{ value: T; label: string; hint?: string }>, field: keyof HouseholdContext, help?: string): Question => ({
      id, group: "Các con", title, help, mode: "single", choices,
      current: (p) => { const value = p.household?.[field]; return typeof value === "string" ? [value] : []; },
      apply: (p, [value]) => household(p, { [field]: pick(list, [value])[0] }),
    });
    questions.push({
      id: "care-deep", group: "Các con", title: "Bạn có muốn FamAgent đánh giá kỹ việc chăm sóc các con không?", help: "Thêm 8 câu (khoảng 1 phút) theo Khung Chăm sóc Nuôi dưỡng của WHO và UNICEF. Kết quả: điểm chăm sóc, điều cần cải thiện và cách làm.", mode: "single",
      choices: [{ value: "yes", label: "Có, đánh giá kỹ giúp mình", hint: "khuyên dùng" }, { value: "no", label: "Để sau" }],
      current: (p) => p.household?.careDeepDive === undefined ? [] : [p.household.careDeepDive ? "yes" : "no"],
      apply: (p, [value]) => household(p, { careDeepDive: value === "yes" }),
    });
    if (profile.household?.careDeepDive) questions.push(
      single("vaccines", "Sổ tiêm chủng của các con hiện thế nào?", VACCINE_STATUS, [{ value: "on_track", label: "Đủ mũi theo lịch" }, { value: "late", label: "Có mũi đang trễ" }, { value: "unsure", label: "Không nắm rõ" }], "vaccines"),
      single("checkup", "Lần gần nhất con được cân đo chiều cao, cân nặng là khi nào?", CHECKUP_RECENCY, [{ value: "recent", label: "Trong 3 tháng gần đây" }, { value: "year", label: "3–12 tháng trước" }, { value: "long", label: "Lâu hơn hoặc không nhớ" }], "checkup"),
      single("sleep", "Con có ngủ đủ và đều giờ không?", SLEEP_QUALITY, [{ value: "good", label: "Ngủ đủ, giờ giấc đều" }, { value: "irregular", label: "Đủ nhưng giờ giấc thất thường" }, { value: "short", label: "Thường thiếu ngủ, hay thức đêm" }], "sleepQuality"),
      single("nutrition", "Bữa ăn của con thường thế nào?", NUTRITION_LEVELS, [{ value: "varied", label: "Đa dạng, đủ nhóm chất" }, { value: "picky", label: "Kén ăn, ít rau hoặc đạm" }, { value: "snacks", label: "Hay ăn vặt, đồ ngọt, uống sữa thay bữa" }], "nutrition"),
      single("play", "Mỗi ngày bố mẹ chơi, trò chuyện riêng với con bao lâu (không cầm điện thoại)?", PLAY_TIME, [{ value: "gt60", label: "Trên 1 giờ" }, { value: "30to60", label: "30–60 phút" }, { value: "lt30", label: "Dưới 30 phút" }], "playTime"),
      single("screen", "Con xem TV, điện thoại, máy tính bảng mỗi ngày bao lâu?", SCREEN_TIME, [{ value: "none", label: "Không xem" }, { value: "lt1h", label: "Dưới 1 giờ" }, { value: "1to2h", label: "1–2 giờ" }, { value: "gt2h", label: "Trên 2 giờ" }], "screenTime"),
      single("reading", "Nhà mình có đọc sách, kể chuyện cho con không?", READING_FREQ, [{ value: "daily", label: "Hằng ngày" }, { value: "sometimes", label: "Thỉnh thoảng" }, { value: "rarely", label: "Hiếm khi" }], "reading"),
      {
        id: "safety", group: "Các con", title: "Nhà mình đã làm những việc an toàn nào cho con?", help: "Chọn tất cả việc đã làm.", mode: "multi",
        choices: [{ value: "stairs", label: "Chặn cầu thang, ban công, cửa sổ" }, { value: "outlets", label: "Che ổ điện, cố định tủ kệ" }, { value: "chemicals", label: "Cất thuốc, hóa chất lên cao" }, { value: "vehicle", label: "Mũ bảo hiểm trẻ em / ghế ô tô đúng cỡ" }, { value: "none", label: "Chưa làm việc nào" }],
        current: (p) => p.household?.safety ? [...p.household.safety] : [],
        apply: (p, values) => household(p, { safety: values.includes("none") ? ["none"] : pick(SAFETY_MEASURES, values) }),
      },
    );
  }
  questions.push(
    {
      id: "housing", group: "Nhà ở", title: "Nhà mình đang ở thế nào?", help: "Nếu thuê nhà, tiền nhà sẽ là khoản cố định trong kế hoạch.", mode: "single",
      choices: [{ value: "own", label: "Nhà của mình" }, { value: "rent", label: "Thuê nhà" }, { value: "with_parents", label: "Ở cùng bố mẹ" }],
      current: (p) => p.household?.housing ? [p.household.housing] : [],
      apply: (p, [value]) => household(p, { housing: pick(HOUSING_TYPES, [value])[0] }),
    },
    {
      id: "income", group: "Tiền", title: "Thu nhập cả nhà mỗi tháng khoảng bao nhiêu?", help: "Ước chừng là được, có thể bỏ qua. Chỉ dùng để tính kế hoạch cho bạn — không chia sẻ với ai.", mode: "single",
      choices: INCOME_CHOICES,
      current: (p) => nearest(INCOME_CHOICES, p.household?.monthlyIncome),
      apply: (p, [value]) => household(p, { monthlyIncome: INCOME_CHOICES.find((choice) => choice.value === value)?.amount }),
    },
    {
      id: "spend", group: "Tiền", title: "Mỗi tháng nhà mình tiêu khoảng bao nhiêu?", help: "Tính cả ăn uống, hóa đơn, chi cho các con — chưa tính trả nợ.", mode: "single",
      choices: SPEND_CHOICES,
      current: (p) => nearest(SPEND_CHOICES, p.household?.monthlySpend),
      apply: (p, [value]) => household(p, { monthlySpend: SPEND_CHOICES.find((choice) => choice.value === value)?.amount }),
    },
    {
      id: "debt", group: "Tiền", title: "Mỗi tháng nhà mình trả nợ, trả góp khoảng bao nhiêu?", help: "Vay mua nhà, xe, trả góp điện thoại, thẻ tín dụng…", mode: "single",
      choices: DEBT_CHOICES,
      current: (p) => nearest(DEBT_CHOICES, p.household?.monthlyDebt),
      apply: (p, [value]) => household(p, { monthlyDebt: DEBT_CHOICES.find((choice) => choice.value === value)?.amount }),
    },
    {
      id: "emergency", group: "Tiền", title: "Nếu tạm mất thu nhập, tiền để dành đủ cho nhà mình sống bao lâu?", mode: "single",
      choices: [{ value: "none", label: "Chưa có khoản để dành" }, { value: "lt3", label: "Dưới 3 tháng" }, { value: "3to6", label: "3–6 tháng" }, { value: "gt6", label: "Trên 6 tháng" }],
      current: (p) => p.household?.emergency ? [p.household.emergency] : [],
      apply: (p, [value]) => household(p, { emergency: pick(EMERGENCY_LEVELS, [value])[0] }),
    },
    {
      id: "tracking", group: "Tiền", title: "Hiện nhà mình theo dõi chi tiêu thế nào?", mode: "single", other: { placeholder: "Ví dụ: vợ giữ sổ, chồng không theo dõi" },
      choices: [{ value: "none", label: "Chưa ghi chép gì" }, { value: "memory", label: "Nhớ trong đầu, áng chừng" }, { value: "spreadsheet", label: "Ghi Excel hoặc sổ tay" }, { value: "app", label: "Dùng một app quản lý chi tiêu" }],
      current: (p) => p.household?.tracking ? [p.household.tracking] : [],
      apply: (p, [value]) => household(p, { tracking: pick(TRACKING_METHODS, [value])[0] }),
    },
    {
      id: "money-pain", group: "Tiền", title: "Chuyện tiền nong, điều gì khiến bạn đau đầu nhất?", help: "Chọn tất cả điều đúng — đây là điều mình sẽ giúp trước.", mode: "multi", other: { placeholder: "Ví dụ: chi cho hai bên nội ngoại nhiều" },
      choices: [
        { value: "short_month_end", label: "Cuối tháng hay bị hụt tiền" }, { value: "unknown_spending", label: "Không biết tiền đi đâu hết" }, { value: "cant_save", label: "Mãi chưa để dành được" },
        { value: "debt", label: "Trả nợ, trả góp nặng quá" }, { value: "couple_disagree", label: "Vợ chồng chưa thống nhất chuyện chi tiêu" }, { value: "none", label: "Không có gì, chỉ muốn gọn gàng hơn" },
      ],
      current: (p) => { const list = p.household?.moneyPains; return list === undefined ? [] : list.length ? [...list] : ["none"]; },
      apply: (p, values) => household(p, { moneyPains: pick(MONEY_PAINS, values) }),
    },
    {
      id: "goals", group: "Tiền", title: "Nhà mình đang để dành cho điều gì?", help: "Chọn tất cả điều đúng — mình sẽ giúp theo dõi tiến độ.", mode: "multi", other: { placeholder: "Ví dụ: cưới hỏi, mở cửa hàng" },
      choices: [
        { value: "emergency", label: "Quỹ dự phòng" }, { value: "education", label: "Học hành của các con" }, { value: "home", label: "Mua hoặc sửa nhà" },
        { value: "car", label: "Mua xe" }, { value: "travel", label: "Du lịch" }, { value: "retirement", label: "Về hưu, chăm sóc bố mẹ" },
      ],
      current: (p) => p.household?.savingGoals ? [...p.household.savingGoals] : [],
      apply: (p, values) => household(p, { savingGoals: pick(SAVING_GOALS, values) }),
    },
  );
  questions.push({
    id: "deep", group: "Phân tích", title: "Bạn có muốn FamAgent phân tích kỹ sức khỏe tài chính của nhà mình không?", help: "Thêm 6 câu (khoảng 1 phút), theo bộ chỉ số sức khỏe tài chính FinHealth. Kết quả: điểm sức khỏe tài chính, vấn đề cần xử lý và cách xử lý.", mode: "single",
    choices: [{ value: "yes", label: "Có, phân tích kỹ giúp mình", hint: "khuyên dùng" }, { value: "no", label: "Để sau, xem nhận định luôn" }],
    current: (p) => p.household?.deepDive === undefined ? [] : [p.household.deepDive ? "yes" : "no"],
    apply: (p, [value]) => household(p, { deepDive: value === "yes" }),
  });
  if (profile.household?.deepDive) {
    const hasDebt = profile.household.monthlyDebt === undefined || profile.household.monthlyDebt > 0;
    questions.push(
      {
        id: "stability", group: "Phân tích", title: "Thu nhập của nhà mình ổn định thế nào?", help: "Thu nhập càng không đều, quỹ dự phòng càng cần dày hơn.", mode: "single",
        choices: [{ value: "stable_both", label: "Cả hai vợ chồng có lương cố định" }, { value: "stable_one", label: "Một người có lương cố định" }, { value: "irregular", label: "Không đều", hint: "kinh doanh, tự do, hoa hồng, theo mùa vụ" }],
        current: (p) => p.household?.incomeStability ? [p.household.incomeStability] : [],
        apply: (p, [value]) => household(p, { incomeStability: pick(INCOME_STABILITY, [value])[0] }),
      },
      {
        id: "bills", group: "Phân tích", title: "12 tháng qua, nhà mình trả hóa đơn, trả góp có đúng hạn không?", mode: "single",
        choices: [{ value: "always", label: "Luôn đúng hạn" }, { value: "sometimes", label: "Thỉnh thoảng trễ" }, { value: "often_late", label: "Hay bị trễ, phải xoay xở" }],
        current: (p) => p.household?.billTimeliness ? [p.household.billTimeliness] : [],
        apply: (p, [value]) => household(p, { billTimeliness: pick(BILL_TIMELINESS, [value])[0] }),
      },
      ...(hasDebt ? [{
        id: "debt-types", group: "Phân tích" as const, title: "Nhà mình đang có những khoản vay nào?", help: "Thẻ tín dụng và vay tiêu dùng thường lãi cao nhất — nên xử lý trước.", mode: "multi" as const, other: { placeholder: "Ví dụ: vay góp vốn kinh doanh" },
        choices: [{ value: "mortgage", label: "Vay mua nhà" }, { value: "car", label: "Vay mua xe" }, { value: "installment", label: "Trả góp đồ dùng, điện thoại" }, { value: "credit_card", label: "Dư nợ thẻ tín dụng" }, { value: "consumer_loan", label: "Vay tiêu dùng, vay qua app" }, { value: "family", label: "Vay người thân, bạn bè" }],
        current: (p: FamilyProfile) => p.household?.debtTypes ? [...p.household.debtTypes] : [],
        apply: (p: FamilyProfile, values: string[]) => household(p, { debtTypes: pick(DEBT_TYPES, values) }),
      }] : []),
      {
        id: "long-term", group: "Phân tích", title: "Ngoài quỹ dự phòng, nhà mình đã tích lũy dài hạn ở đâu?", help: "Chọn tất cả điều đúng.", mode: "multi", other: { placeholder: "Ví dụ: góp hụi, cho vay" },
        choices: [{ value: "bank_term", label: "Gửi tiết kiệm dài hạn" }, { value: "gold", label: "Vàng" }, { value: "property", label: "Đất, nhà cho thuê" }, { value: "stocks", label: "Chứng khoán, chứng chỉ quỹ" }, { value: "life_insurance", label: "Bảo hiểm nhân thọ có tích lũy" }, { value: "none", label: "Chưa có" }],
        current: (p) => p.household?.longTermSavings ? [...p.household.longTermSavings] : [],
        apply: (p, values) => household(p, { longTermSavings: values.includes("none") ? ["none"] : pick(LONG_TERM_SAVINGS, values) }),
      },
      {
        id: "insurance", group: "Phân tích", title: "Nhà mình đã có những bảo hiểm nào?", help: "Bảo hiểm giúp một lần ốm đau hay rủi ro không xóa sạch tiền để dành.", mode: "multi",
        choices: [{ value: "public_health", label: "Bảo hiểm y tế cho cả nhà" }, { value: "private_health", label: "Bảo hiểm sức khỏe tư nhân" }, { value: "life_main_earner", label: "Bảo hiểm nhân thọ cho người kiếm tiền chính" }, { value: "none", label: "Chưa có" }],
        current: (p) => p.household?.insurance ? [...p.household.insurance] : [],
        apply: (p, values) => household(p, { insurance: values.includes("none") ? ["none"] : pick(INSURANCE_TYPES, values) }),
      },
      {
        id: "planning", group: "Phân tích", title: "Nhà mình có kế hoạch tiền bạc cho 1–5 năm tới chưa?", mode: "single",
        choices: [{ value: "specific", label: "Có, với con số và thời hạn rõ ràng" }, { value: "rough", label: "Có ý tưởng nhưng chưa cụ thể" }, { value: "none", label: "Chưa nghĩ tới" }],
        current: (p) => p.household?.planning ? [p.household.planning] : [],
        apply: (p, [value]) => household(p, { planning: pick(PLANNING_LEVELS, [value])[0] }),
      },
    );
  }
  questions.push({
    id: "style", group: "Mục tiêu", title: "Nhà mình thích cách nào khi chi tiêu và mua sắm?", help: "FamAgent sẽ gợi ý và nhắc theo cách này. Đổi được bất cứ lúc nào.", mode: "single",
    choices: [
      { value: "saving", label: "Tiết kiệm", hint: "ưu tiên giá tốt, chờ sale nếu còn đồ, báo sớm khi chi vượt" },
      { value: "balanced", label: "Cân bằng", hint: "giá hợp lý, không mất nhiều thời gian so sánh" },
      { value: "convenience", label: "Tiện lợi", hint: "mua lại nhanh món quen, nhắc sớm để không bị hết" },
    ],
    current: (p) => p.household?.style ? [p.household.style] : [],
    apply: (p, [value]) => { const style = pick(HOUSEHOLD_STYLES, [value])[0]; return style ? { ...household(p, { style }), pricePreference: STYLE_PRICE[style] } : p; },
  });
  const all = questions.map(withOther);
  if (section === "all") return all;
  if (section === "care") return all.filter((question) => CARE.test(question.id));
  if (section === "money") return all.filter((question) => !CORE.test(question.id) && !CARE.test(question.id));
  // Core: nhà mình → thành viên → ưu tiên → phong cách (spec order).
  const core = all.filter((question) => CORE.test(question.id));
  return [...core.filter((question) => question.id !== "focus" && question.id !== "style"), ...core.filter((question) => question.id === "focus"), ...core.filter((question) => question.id === "style")];
}

/** Records answered/skipped ids (profile.onboarding v2) so analytics and resume see the same state. */
export function markQuestion(profile: FamilyProfile, id: string, skipped: boolean): FamilyProfile {
  const state = profile.onboarding ?? { version: 2 as const, completedSlots: [], skippedSlots: [] };
  const completed = state.completedSlots.filter((slot) => slot !== id);
  const skippedList = state.skippedSlots.filter((slot) => slot !== id);
  (skipped ? skippedList : completed).push(id);
  return { ...profile, onboarding: { version: 2, completedSlots: completed.slice(-30), skippedSlots: skippedList.slice(-30) } };
}
