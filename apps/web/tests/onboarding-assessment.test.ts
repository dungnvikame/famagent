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

test("tình hình: còn dư bao nhiêu, quỹ dự phòng 6 tháng chi tiêu; không tự chọn phương pháp thay người dùng", () => {
  const a = buildAssessment(base({ monthlyIncome: 22_000_000, monthlySpend: 15_000_000, monthlyDebt: 5_000_000, emergency: "none", moneyPains: ["cant_save"] }), now);
  assert.equal("method" in a.finance, false);
  assert.match(a.finance.points[0], /còn dư khoảng 2 triệu \(9% thu nhập\)/);
  assert.equal(a.plan.emergencyTarget, 90_000_000);
  assert.ok(a.finance.points.some((point) => /khoảng 90 triệu/.test(point)));
  assert.equal(a.headline, "Nền tài chính ổn, nhưng cần một quỹ dự phòng vững hơn");
  assert.ok(a.steps.some((step) => /Quỹ dự phòng 90 triệu/.test(step.label)));
});

test("nợ trên 30% thu nhập → ưu tiên trả nợ; chi vượt thu → cảnh báo và kế hoạch chi thấp hơn", () => {
  const debt = buildAssessment(base({ monthlyIncome: 22_000_000, monthlySpend: 8_000_000, monthlyDebt: 10_000_000 }), now);
  assert.ok(debt.finance.points.some((point) => /45% thu nhập/.test(point)));
  const over = buildAssessment(base({ monthlyIncome: 12_000_000, monthlySpend: 15_000_000 }), now);
  assert.match(over.headline, /chi nhiều hơn khả năng/);
  assert.ok(over.plan.monthlyPlan! < 15_000_000);
});

test("framework: 6 phương pháp có nguồn gốc; gợi ý theo câu trả lời (chỉ là nhãn, tối đa 2)", async () => {
  const { FRAMEWORKS, suggestFrameworks, frameworkProgress, frameworkById, babyStep, bucketOf } = await import("../src/lib/money/frameworks.ts");
  assert.deepEqual(FRAMEWORKS.map((fw) => fw.id), ["jars", "50-30-20", "pay-first", "zero-based", "kakeibo", "baby-steps"]);
  for (const fw of FRAMEWORKS) {
    assert.ok(fw.origin.length > 10, fw.id);
    const shares = fw.buckets.filter((bucket) => bucket.share !== undefined).reduce((sum, bucket) => sum + bucket.share!, 0);
    if (shares) assert.ok(Math.abs(shares - 1) < 1e-9, `${fw.id} tỷ lệ cộng lại 100%`);
  }
  assert.deepEqual(suggestFrameworks(base({ monthlyIncome: 20_000_000, monthlyDebt: 8_000_000, moneyPains: ["cant_save"] })).map((item) => item.id), ["baby-steps", "pay-first"]);
  assert.deepEqual(suggestFrameworks(base({ tracking: "spreadsheet" })).map((item) => item.id), ["zero-based"]);
  assert.deepEqual(suggestFrameworks(base({})).map((item) => item.id), ["50-30-20"]);
  assert.equal(babyStep(base({ emergency: "lt3", monthlyDebt: 3_000_000 })).step, 2);
  assert.equal(bucketOf("jars", { kind: "expense", category: "Học tập", amount: 1 }), "edu");
  assert.equal(bucketOf("jars", { kind: "saving", category: "Tiết kiệm", amount: 1 }), "ltss");
  assert.equal(bucketOf("50-30-20", { kind: "expense", category: "Du lịch", amount: 1 }), "wants");
  assert.equal(bucketOf("kakeibo", { kind: "expense", category: "Khám, thuốc", amount: 1 }), "unexpected");
  const tx = (kind: "expense" | "saving", category: string, amount: number) => ({ id: category, occurredOn: "2026-09-10", content: category, category, kind, amount, forChild: false, source: "manual" as const });
  const rows = frameworkProgress(frameworkById("50-30-20")!, 20_000_000, [tx("expense", "Ăn uống", 6_000_000), tx("expense", "Mua sắm", 7_000_000), tx("saving", "Tiết kiệm", 2_000_000), tx("saving", "Rút tiết kiệm", -500_000)]);
  assert.deepEqual(rows.map((row) => [row.key, row.target, row.actual]), [["needs", 10_000_000, 6_000_000], ["wants", 6_000_000, 7_000_000], ["save", 4_000_000, 2_000_000]]);
  const zero = frameworkProgress(frameworkById("zero-based")!, 20_000_000, [tx("saving", "Tiết kiệm", 2_000_000)], [{ id: "b", category: "Ăn uống", month: "2026-09", limitAmount: 15_000_000 }]);
  assert.deepEqual(zero.map((row) => row.actual), [17_000_000, 3_000_000]);
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
