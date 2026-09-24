import assert from "node:assert/strict";
import test from "node:test";
import { buildAssessment, money } from "../src/lib/onboarding/assessment.ts";
import { buildQuestions, OTHER_PREFIX } from "../src/lib/onboarding/questions.ts";
import { validProfile } from "../src/lib/experience/validate.ts";
import type { FamilyProfile, HouseholdContext } from "../src/lib/experience/types.ts";

const now = new Date("2026-09-24T09:00:00+07:00");
const base = (household: HouseholdContext, children: FamilyProfile["children"] = []): FamilyProfile => ({ id: "p", children, pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-24T00:00:00Z", household });

test("money(): triệu có một chữ số thập phân, nghìn làm tròn", () => {
  assert.equal(money(12_500_000), "12,5 triệu"); assert.equal(money(40_000_000), "40 triệu"); assert.equal(money(800_000), "800 nghìn");
});

test("dư mỏng + chưa để dành được → 'Để dành trước, tiêu sau', quỹ dự phòng 6 tháng chi tiêu", () => {
  const a = buildAssessment(base({ monthlyIncome: 22_000_000, monthlySpend: 15_000_000, monthlyDebt: 5_000_000, emergency: "none", moneyPains: ["cant_save"] }), now);
  assert.equal(a.finance.method, "Để dành trước, tiêu sau");
  assert.match(a.finance.points[0], /còn dư khoảng 2 triệu \(9% thu nhập\)/);
  assert.equal(a.plan.emergencyTarget, 90_000_000);
  assert.ok(a.finance.points.some((point) => /khoảng 90 triệu/.test(point)));
  assert.equal(a.headline, "Nền tài chính ổn, nhưng cần một quỹ dự phòng vững hơn");
  assert.ok(a.plan.monthlySaving && a.plan.monthlySaving >= 2_000_000);
  assert.ok(a.steps.some((step) => /Quỹ dự phòng 90 triệu/.test(step.label)));
});

test("nợ trên 30% thu nhập → ưu tiên trả nợ; chi vượt thu → cảnh báo và kế hoạch chi thấp hơn", () => {
  const debt = buildAssessment(base({ monthlyIncome: 22_000_000, monthlySpend: 8_000_000, monthlyDebt: 10_000_000 }), now);
  assert.match(debt.finance.method, /Ưu tiên trả nợ/);
  assert.ok(debt.finance.points.some((point) => /45% thu nhập/.test(point)));
  const over = buildAssessment(base({ monthlyIncome: 12_000_000, monthlySpend: 15_000_000 }), now);
  assert.match(over.headline, /chi nhiều hơn khả năng/);
  assert.ok(over.plan.monthlyPlan! < 15_000_000);
});

test("không ghi chép + cuối tháng hụt → 50/30/20 với con số cụ thể", () => {
  const a = buildAssessment(base({ monthlyIncome: 40_000_000, monthlySpend: 25_000_000, tracking: "none", moneyPains: ["short_month_end"] }), now);
  assert.equal(a.finance.method, "Chia thu nhập 50 / 30 / 20");
  assert.ok(a.finance.points.some((point) => /thiết yếu tối đa 20 triệu, mong muốn tối đa 12 triệu, để dành ít nhất 8 triệu/.test(point)));
});

test("kế hoạch chăm sóc theo độ tuổi và nỗi lo; đang chờ em bé có quỹ sinh", () => {
  const a = buildAssessment(base({ monthlySpend: 20_000_000, careWorries: ["cost", "sleep"] }, [{ id: "c1", name: "Gold", ageMonths: 9, sensitivities: ["rash_prone"] }]), now);
  assert.ok(a.care.points.some((point) => /Bé Gold dưới 1 tuổi/.test(point)));
  assert.ok(a.care.points.some((point) => /hay hăm, mẩn ngứa/.test(point)));
  assert.ok(a.care.points.some((point) => /khoảng 3 triệu\/tháng \(15% chi tiêu\)/.test(point)));
  const expecting = buildAssessment(base({ setup: "expecting", careWorries: ["caregiver"] }), now);
  assert.ok(expecting.care.points.some((point) => /chi phí sinh và 6 tháng đầu/.test(point)));
  const empty = buildAssessment(base({}), now);
  assert.match(empty.note, /chưa chia sẻ số liệu thu chi/);
  assert.equal(empty.steps[0].label, "Ghi 3 khoản chi đầu tiên");
});

test("mọi con số trong nhận định tài chính đều nằm trong facts (để AI không bịa số)", () => {
  const a = buildAssessment(base({ monthlyIncome: 40_000_000, monthlySpend: 25_000_000, monthlyDebt: 3_000_000, emergency: "lt3", moneyPains: ["unknown_spending"] }), now);
  for (const point of a.finance.points) assert.ok(a.facts.includes(point), point);
  const named = buildAssessment(base({ monthlySpend: 20_000_000 }, [{ id: "c1", name: "Gold", ageMonths: 9 }]), now);
  assert.ok(named.facts.every((line) => !line.includes("Gold")), "tên con không nằm trong facts gửi AI");
});

test("'Khác — tự nhập' lưu vào household.notes và đọc lại; một mình câu tự nhập vẫn hợp lệ", () => {
  let profile = base({});
  const q = (id: string) => buildQuestions(profile, () => crypto.randomUUID(), now.getTime()).find((item) => item.id === id)!;
  profile = q("money-pain").apply(profile, ["cant_save", `${OTHER_PREFIX}Chi cho hai bên nội ngoại nhiều`]);
  assert.deepEqual(profile.household?.moneyPains, ["cant_save"]);
  assert.equal(profile.household?.notes?.["money-pain"], "Chi cho hai bên nội ngoại nhiều");
  assert.deepEqual(q("money-pain").current(profile), ["cant_save", `${OTHER_PREFIX}Chi cho hai bên nội ngoại nhiều`]);
  profile = q("tracking").apply(profile, [`${OTHER_PREFIX}Vợ giữ sổ`]);
  assert.equal(profile.household?.tracking, undefined);
  assert.equal(profile.household?.notes?.tracking, "Vợ giữ sổ");
  assert.ok(validProfile(profile));
  profile = q("money-pain").apply(profile, ["debt"]);
  assert.equal(profile.household?.notes?.["money-pain"], undefined, "bỏ chữ tự nhập thì xóa ghi chú");
});
