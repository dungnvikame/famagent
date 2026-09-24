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

test("bộ câu hỏi v3: mục tiêu → gia đình → từng bé → mua sắm → tiền; câu đầu không hỏi số người lớn", () => {
  const first = buildQuestions(blank(), newId);
  assert.equal(first[0].id, "focus");
  assert.ok(!first.some((q) => q.id === "adults"));
  assert.equal(first.length, 7, "focus, setup, kids, concern, budget, merchants, spend");
  const one = answer(blank(), "kids", ["1"]);
  assert.equal(buildQuestions(one, newId).length, 12, "+5 câu cho mỗi bé: tên, tuổi, cân nặng, hãng đang dùng, lưu ý");
  const three = answer(one, "kids", ["3"]);
  assert.equal(three.children.length, 3);
  assert.equal(buildQuestions(three, newId).length, 22);
  assert.equal(three.children[0].id, one.children[0].id, "giữ bé đã có khi tăng số bé");
  assert.equal(answer(three, "kids", ["1"]).children.length, 1);
  assert.deepEqual([...new Set(buildQuestions(one, newId).map((q) => q.group))], ["Mục tiêu", "Gia đình", "Về bé", "Mua sắm", "Tiền"]);
});

test("gia đình: kiểu nhà suy ra số người lớn; đang chờ em bé bỏ phần câu hỏi về bé", () => {
  let profile = answer(blank(), "focus", ["money", "replenish"]);
  assert.deepEqual(profile.household?.focus, ["money", "replenish"]);
  profile = answer(profile, "setup", ["multigen"]);
  assert.equal(profile.adultsCount, 4); assert.equal(profile.household?.setup, "multigen");
  profile = answer(profile, "kids", ["1"]);
  const expecting = answer(profile, "setup", ["expecting"]);
  assert.equal(expecting.children.length, 0);
  assert.ok(!buildQuestions(expecting, newId).some((q) => q.id === "kids" || q.id.startsWith("child-")));
  assert.match(buildQuestions(expecting, newId).find((q) => q.id === "concern")!.title, /chuẩn bị đồ cho bé/);
});

test("hãng đang dùng, nơi mua, chi tiêu tháng được lưu và đọc lại", () => {
  let profile = answer(blank(), "kids", ["1"]);
  const id = profile.children[0].id;
  profile = answer(profile, `child-brand:${id}`, ["Merries"]);
  assert.equal(profile.children[0].currentBrand, "Merries");
  assert.equal(answer(profile, `child-brand:${id}`, ["other"]).children[0].currentBrand, undefined);
  profile = answer(profile, "merchants", ["shopee", "concung"]);
  assert.deepEqual(profile.household?.merchants, ["shopee", "concung"]);
  profile = answer(profile, "spend", ["25000000"]);
  assert.equal(profile.household?.monthlySpend, 25_000_000);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === "spend")!.current(profile), ["25000000"]);
  const cheap = answer(profile, "concern", ["value"]);
  assert.equal(cheap.pricePreference, "value", "lo tiết kiệm → xếp theo giá trị mỗi miếng");
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
  profile = answer(profile, `child-age:${id}`, ["6-12"]);
  assert.equal(profile.children[0].ageMonths, AGE_CHOICES.find((c) => c.value === "6-12")!.months);
  assert.equal(profile.children[0].birthDate, undefined);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === `child-age:${id}`)!.current(profile), ["6-12"]);
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

test("mua sắm: ngân sách 'không đặt giới hạn' xóa mức trần; nỗi lo chính được lưu", () => {
  let profile = answer(blank(), "budget", ["350000"]);
  assert.equal(profile.maxBudget, 350000);
  assert.deepEqual(buildQuestions(profile, newId).find((q) => q.id === "budget")!.current(profile), ["350000"]);
  profile = answer(profile, "budget", ["none"]);
  assert.equal(profile.maxBudget, undefined);
  profile = answer(profile, "concern", ["night"]);
  assert.equal(profile.mainConcern, "night");
  assert.equal(profile.pricePreference, "balanced");
});

test("markQuestion ghi đã trả lời / bỏ qua, không trùng, tối đa 30", () => {
  let profile = markQuestion(blank(), "adults", false);
  profile = markQuestion(profile, "adults", true);
  assert.deepEqual(profile.onboarding, { version: 2, completedSlots: [], skippedSlots: ["adults"] });
  for (let i = 0; i < 40; i++) profile = markQuestion(profile, `q${i}`, false);
  assert.equal(profile.onboarding!.completedSlots.length, 30);
  assert.ok(validProfile(profile));
});
