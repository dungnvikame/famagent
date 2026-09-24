import assert from "node:assert/strict";
import test from "node:test";
import { AGE_CHOICES, buildQuestions, markQuestion, WEIGHT_CHOICES, weightChoiceFor } from "../src/lib/onboarding/questions.ts";
import { validProfile } from "../src/lib/experience/validate.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const blank = (): FamilyProfile => ({ id: "p1", children: [], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-24T00:00:00Z" });
const answer = (profile: FamilyProfile, id: string, values: string[]) => {
  const question = buildQuestions(profile, newId).find((item) => item.id === id);
  assert.ok(question, `question ${id}`);
  const next = question!.apply(profile, values);
  assert.ok(validProfile(next), `${id} keeps the profile valid`);
  return next;
};

test("bộ câu hỏi v5: insight gia đình để đưa ra nhận định, không nhắc sản phẩm", () => {
  const first = buildQuestions(blank(), newId);
  assert.equal(first[0].id, "focus");
  assert.deepEqual(first.map((q) => q.id), ["focus", "setup", "kids", "care-worry", "care-deep", "housing", "income", "spend", "debt", "emergency", "tracking", "money-pain", "goals", "deep"]);
  assert.deepEqual(first.filter((q) => q.other).map((q) => q.id), ["focus", "care-worry", "tracking", "money-pain", "goals"]);
  const one = answer(blank(), "kids", ["1"]);
  assert.equal(buildQuestions(one, newId).length, 18, "+4 câu cho mỗi con: tên, tuổi, cân nặng (dưới 6 tuổi), sức khỏe");
  const three = answer(one, "kids", ["3"]);
  assert.equal(three.children.length, 3);
  assert.equal(buildQuestions(three, newId).length, 26);
  assert.equal(three.children[0].id, one.children[0].id, "giữ con đã có khi tăng số con");
  assert.equal(answer(three, "kids", ["1"]).children.length, 1);
  const text = JSON.stringify(buildQuestions(one, newId).map((q) => [q.title, q.help, q.choices]));
  assert.doesNotMatch(text, /bỉm|tã|size|hãng|gói|sản phẩm|Shopee/i, "onboarding không nói về sản phẩm");
  assert.deepEqual([...new Set(buildQuestions(one, newId).map((q) => q.group))], ["Mục tiêu", "Gia đình", "Các con", "Nhà ở", "Tài chính", "Phân tích"]);
});

test("gia đình: kiểu nhà suy ra số người lớn; chưa có con / đang chờ em bé bỏ phần câu hỏi về con; con từ 6 tuổi không hỏi cân nặng", () => {
  let profile = answer(blank(), "focus", ["money", "care"]);
  assert.deepEqual(profile.household?.focus, ["money", "care"]);
  profile = answer(profile, "setup", ["multigen"]);
  assert.equal(profile.adultsCount, 4);
  profile = answer(profile, "kids", ["1"]);
  for (const setup of ["expecting", "no_kids"]) {
    const next = answer(profile, "setup", [setup]);
    assert.equal(next.children.length, 0);
    assert.ok(!buildQuestions(next, newId).some((q) => q.id === "kids" || q.id.startsWith("child-")), setup);
  }
  const id = profile.children[0].id;
  const older = answer(profile, `child-age:${id}`, ["72-144"]);
  assert.ok(!buildQuestions(older, newId).some((q) => q.id === `child-weight:${id}`));
});

test("nhà ở, thu nhập, chi tiêu, mục tiêu để dành được lưu và đọc lại", () => {
  let profile = answer(blank(), "housing", ["rent"]);
  assert.equal(profile.household?.housing, "rent");
  profile = answer(profile, "income", ["40000000"]);
  assert.equal(profile.household?.monthlyIncome, 40_000_000);
  profile = answer(profile, "spend", ["25000000"]);
  assert.equal(profile.household?.monthlySpend, 25_000_000);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === "spend")!.current(profile), ["25000000"]);
  profile = answer(profile, "goals", ["emergency", "education"]);
  assert.deepEqual(profile.household?.savingGoals, ["emergency", "education"]);
});

test("cân nặng: khoảng lưu giá trị giữa, số chính xác được ưu tiên, size cũ bị bỏ khi cân nặng đổi", () => {
  let profile = answer(blank(), "kids", ["1"]);
  profile = { ...profile, children: [{ ...profile.children[0], diaperSize: "L" }] };
  const weightId = `child-weight:${profile.children[0].id}`;
  const ranged = answer(profile, weightId, ["8-11"]);
  assert.equal(ranged.children[0].weightKg, 9.5);
  assert.equal(ranged.children[0].diaperSize, undefined);
  assert.deepEqual(buildQuestions(ranged, newId).find((q) => q.id === weightId)!.current(ranged), ["8-11"]);
  const exact = answer(profile, weightId, ["10.55"]);
  assert.equal(exact.children[0].weightKg, 10.6);
  assert.equal(weightChoiceFor(10.6), "8-11");
  assert.equal(weightChoiceFor(17), "17+");
  assert.equal(weightChoiceFor(2), "<5");
  for (const choice of WEIGHT_CHOICES) assert.ok(choice.kg >= choice.min && choice.kg < choice.max, choice.value);
});

test("tuổi theo khoảng thay ngày sinh; chăm sóc 'không có gì' lưu danh sách rỗng; tên là tùy chọn", () => {
  let profile = answer(blank(), "kids", ["1"]);
  const id = profile.children[0].id;
  profile = { ...profile, children: [{ ...profile.children[0], birthDate: "2025-01-01" }] };
  profile = answer(profile, `child-age:${id}`, ["0-12"]);
  assert.equal(profile.children[0].ageMonths, AGE_CHOICES.find((c) => c.value === "0-12")!.months);
  assert.equal(profile.children[0].birthDate, undefined);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === `child-age:${id}`)!.current(profile), ["0-12"]);
  profile = answer(profile, `child-care:${id}`, ["none"]);
  assert.deepEqual(profile.children[0].sensitivities, []);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === `child-care:${id}`)!.current(profile), ["none"]);
  profile = answer(profile, `child-care:${id}`, ["sensitive_skin", "rash_prone"]);
  assert.deepEqual(profile.children[0].sensitivities, ["sensitive_skin", "rash_prone"]);
  profile = answer(profile, `child-name:${id}`, ["  Gold  "]);
  assert.equal(profile.children[0].name, "Gold");
  assert.equal(answer(profile, `child-name:${id}`, [""]).children[0].name, undefined);
  assert.match(buildQuestions(profile, newId).find((q) => q.id === `child-weight:${id}`)!.title, /Bé Gold/);
});

test("markQuestion ghi đã trả lời / bỏ qua, không trùng, tối đa 30", () => {
  let profile = markQuestion(blank(), "focus", false);
  profile = markQuestion(profile, "focus", true);
  assert.deepEqual(profile.onboarding, { version: 2, completedSlots: [], skippedSlots: ["focus"] });
  for (let i = 0; i < 40; i++) profile = markQuestion(profile, `q${i}`, false);
  assert.equal(profile.onboarding!.completedSlots.length, 30);
  assert.ok(validProfile(profile));
});
