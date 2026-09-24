import assert from "node:assert/strict";
import test from "node:test";
import { financialHealth } from "../src/lib/money/health.ts";
import { buildAssessment } from "../src/lib/onboarding/assessment.ts";
import { buildQuestions } from "../src/lib/onboarding/questions.ts";
import { suggestFrameworks } from "../src/lib/money/frameworks.ts";
import type { FamilyProfile, HouseholdContext } from "../src/lib/experience/types.ts";

const base = (household: HouseholdContext, children: FamilyProfile["children"] = []): FamilyProfile => ({ id: "p", children, pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-24T00:00:00Z", household });
const deep: HouseholdContext = { deepDive: true, monthlyIncome: 30_000_000, monthlySpend: 20_000_000, monthlyDebt: 12_000_000, emergency: "none", incomeStability: "irregular", billTimeliness: "sometimes", debtTypes: ["credit_card", "car"], longTermSavings: ["none"], insurance: ["public_health"], planning: "rough" };

test("8 chỉ số theo 4 trụ; chưa đủ 3 chỉ số thì chưa chấm điểm", () => {
  const empty = financialHealth(base({}));
  assert.equal(empty.indicators.length, 8);
  assert.deepEqual([...new Set(empty.indicators.map((item) => item.pillar))], ["Chi tiêu", "Tiết kiệm", "Vay nợ", "Kế hoạch"]);
  assert.equal(empty.score, undefined);
  assert.ok(empty.indicators.every((item) => item.status === "unknown"));
});

test("gia đình nhiều rủi ro: điểm thấp, vấn đề sắp xếp theo mức khẩn cấp, quỹ dự phòng 9 tháng vì thu nhập không đều", () => {
  const report = financialHealth(base(deep, [{ id: "c1", ageMonths: 9 }]));
  const status = Object.fromEntries(report.indicators.map((item) => [item.key, item.status]));
  assert.deepEqual(status, { spend: "vulnerable", bills: "coping", liquid: "vulnerable", "long-term": "vulnerable", debt: "vulnerable", stability: "vulnerable", insurance: "coping", plan: "coping" });
  assert.equal(report.score, Math.round((20 * 5 + 60 * 3) / 8));
  assert.equal(report.tier, "vulnerable");
  assert.equal(report.emergencyMonths, 9);
  assert.deepEqual(report.problems.map((item) => item.key), ["spend", "liquid", "debt", "stability", "long-term", "bills", "insurance", "plan"]);
  assert.match(report.problems.find((item) => item.key === "debt")!.problem!, /40% thu nhập — vượt ngưỡng 36%/);
  assert.match(report.problems.find((item) => item.key === "insurance")!.problem!, /con nhỏ.*nhân thọ/);
  assert.ok(report.problems.every((item) => item.fix && item.fix.length > 20));
});

test("gia đình vững vàng: không có vấn đề", () => {
  const report = financialHealth(base({ monthlyIncome: 40_000_000, monthlySpend: 25_000_000, monthlyDebt: 3_000_000, emergency: "gt6", incomeStability: "stable_both", billTimeliness: "always", debtTypes: ["mortgage"], longTermSavings: ["bank_term", "gold"], insurance: ["public_health", "life_main_earner"], planning: "specific" }, [{ id: "c1", ageMonths: 30 }]));
  assert.equal(report.tier, "healthy"); assert.equal(report.score, 90); assert.deepEqual(report.problems, []);
});

test("assessment dùng số tháng dự phòng theo độ ổn định thu nhập; facts có đủ kết quả sức khỏe tài chính", () => {
  const a = buildAssessment(base(deep));
  assert.equal(a.plan.emergencyTarget, 180_000_000);
  assert.ok(a.finance.points.some((point) => /9 tháng chi tiêu, tức khoảng 180 triệu/.test(point)));
  assert.ok(a.facts.some((line) => /^Điểm sức khỏe tài chính \d+\/100/.test(line)));
  assert.ok(a.facts.some((line) => /Nợ trong tầm kiểm soát: Dễ tổn thương/.test(line)));
});

test("câu hỏi phân tích sâu chỉ xuất hiện khi người dùng đồng ý; không có nợ thì bỏ câu loại khoản vay", () => {
  const ids = (h: HouseholdContext) => buildQuestions(base(h)).map((q) => q.id);
  assert.ok(ids({}).includes("deep"));
  assert.ok(!ids({ deepDive: false }).includes("stability"));
  assert.deepEqual(ids({ deepDive: true }).slice(-6), ["stability", "bills", "debt-types", "long-term", "insurance", "planning"]);
  assert.ok(!ids({ deepDive: true, monthlyDebt: 0 }).includes("debt-types"));
  const q = buildQuestions(base({ deepDive: true })).find((item) => item.id === "long-term")!;
  assert.deepEqual(q.apply(base({}), ["gold", "none"]).household?.longTermSavings, ["none"], "'Chưa có' loại trừ lựa chọn khác");
});

test("gợi ý phương pháp dùng kết quả phân tích sâu", () => {
  assert.deepEqual(suggestFrameworks(base({ debtTypes: ["credit_card"], incomeStability: "irregular" })).map((item) => item.id), ["baby-steps", "zero-based"]);
});
