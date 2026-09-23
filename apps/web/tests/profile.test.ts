import assert from "node:assert/strict";
import test from "node:test";
import { validBirthDate, validProfile } from "../src/lib/experience/validate.ts";
import { childAgeMonths, childRow, familyRow, profileFromRow } from "../src/lib/experience/profile-mapper.ts";
import { stampChanges } from "../src/lib/experience/profile-meta.ts";
import { parseProfileChange } from "../src/lib/ai/profile-change.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const childId = "11111111-1111-4111-8111-111111111111";
const base: FamilyProfile = { id: "p1", children: [{ id: childId, name: "Gold", weightKg: 10, diaperSize: "L" }], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-23T00:00:00.000Z" };

const full: FamilyProfile = {
  ...base, familyName: "Nhà Gold", adultsCount: 2, pricePreference: "value", deliveryPreference: "fastest", mainConcern: "night", maxBudget: 400_000,
  preferredBrands: ["Bobby"], avoidedIngredients: ["hương liệu"], appliances: { washingMachine: "front" },
  onboarding: { version: 2, completedSlots: ["household"], skippedSlots: ["home"] },
  fieldMeta: { maxBudget: { source: "user_entered", observedAt: "2026-09-23T00:00:00.000Z", confirmedAt: "2026-09-23T00:00:00.000Z" } },
  children: [{ id: childId, name: "Gold", birthDate: "2025-07-10", weightKg: 10.2, diaperSize: "L", sensitivities: ["sensitive_skin"], currentBrand: "Bobby", preferredBrands: ["Merries"], dislikedBrands: ["Huggies"] }],
};

test("hồ sơ v1 cũ (chỉ trường cơ bản) vẫn hợp lệ", () => {
  assert.equal(validProfile(base), true);
});

test("hồ sơ v2 đầy đủ hợp lệ", () => {
  assert.equal(validProfile(full), true);
});

test("từ chối giá trị ngoài giới hạn", () => {
  const withChild = (patch: object) => ({ ...full, children: [{ ...full.children[0], ...patch }] });
  assert.equal(validProfile({ ...full, pricePreference: "cheap" }), false);
  assert.equal(validProfile({ ...full, adultsCount: 0 }), false);
  assert.equal(validProfile({ ...full, preferredBrands: Array.from({ length: 11 }, (_, i) => `b${i}`) }), false);
  assert.equal(validProfile({ ...full, appliances: { washingMachine: "side" } }), false);
  assert.equal(validProfile({ ...full, fieldMeta: { maxBudget: { source: "llm_guess", observedAt: "2026-09-23T00:00:00Z" } } }), false);
  assert.equal(validProfile(withChild({ sensitivities: ["allergy"] })), false);
  assert.equal(validProfile(withChild({ sensitivities: ["sensitive_skin", "sensitive_skin"] })), false);
  assert.equal(validProfile(withChild({ weightKg: 31 })), false);
  assert.equal(validProfile(withChild({ currentBrand: "x".repeat(41) })), false);
});

test("ngày sinh: đúng định dạng, không ở tương lai (chừa 1 ngày lệch múi giờ); dữ liệu đã lưu không bị lão hóa thành không hợp lệ", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  assert.equal(validBirthDate("2025-07-10", now), true);
  assert.equal(validBirthDate("2026-09-24", now), true);
  assert.equal(validBirthDate("2026-09-25", now), false);
  assert.equal(validBirthDate("2020-09-22", now), true);
  assert.equal(validBirthDate("2020-09-22", now, 6), false);
  assert.equal(validBirthDate("2008-09-22", now), false);
  assert.equal(validBirthDate("2025-02-30", now), false);
  assert.equal(validBirthDate("10/07/2025", now), false);
});

test("tuổi tính từ ngày sinh, ưu tiên hơn ageMonths", () => {
  const now = new Date("2026-09-23T00:00:00Z");
  assert.equal(childAgeMonths({ id: childId, birthDate: "2025-07-10", ageMonths: 3 }, now), 14);
  assert.equal(childAgeMonths({ id: childId, birthDate: "2025-07-24" }, now), 13);
  assert.equal(childAgeMonths({ id: childId, ageMonths: 5 }, now), 5);
});

test("mapper: profile → rows → profile giữ nguyên dữ liệu", () => {
  const family = familyRow(full, "user-1", full.updatedAt);
  const children = full.children.map((child, index) => childRow(child, "p1", index, full.updatedAt));
  const back = profileFromRow({ ...family, id: "p1", children });
  assert.deepEqual(JSON.parse(JSON.stringify(back)), full);
});

test("mapper: row thiếu cột mới (dữ liệu trước migration) vẫn map được", () => {
  const back = profileFromRow({ id: "p1", price_preference: "balanced", ai_consent: false, updated_at: base.updatedAt, children: [{ id: childId, name: "Gold", current_weight_kg: "10.00", diaper_size: "L", position: 0 }] });
  assert.deepEqual(back.children[0], { id: childId, name: "Gold", birthDate: undefined, weightKg: 10, ageMonths: undefined, diaperSize: "L", sensitivities: undefined, currentBrand: undefined, preferredBrands: undefined, dislikedBrands: undefined });
  assert.equal(back.fieldMeta, undefined);
});

test("stampChanges: ghi nguồn cho trường đổi, giữ meta cũ cho trường không đổi, bỏ meta khi xóa giá trị", () => {
  const first = stampChanges(null, base, "user_entered", "2026-09-23T01:00:00.000Z");
  assert.equal(first.fieldMeta?.[`children.${childId}.weightKg`]?.confirmedAt, "2026-09-23T01:00:00.000Z");
  const edited = { ...first, maxBudget: 300_000, children: [{ ...first.children[0], weightKg: 11, diaperSize: undefined }] };
  const second = stampChanges(first, edited, "user_confirmed", "2026-09-24T00:00:00.000Z");
  assert.deepEqual(second.fieldMeta?.[`children.${childId}.weightKg`], { source: "user_confirmed", observedAt: "2026-09-24T00:00:00.000Z", confirmedAt: "2026-09-24T00:00:00.000Z" });
  assert.equal(second.fieldMeta?.[`children.${childId}.name`]?.observedAt, "2026-09-23T01:00:00.000Z");
  assert.equal(second.fieldMeta?.[`children.${childId}.diaperSize`], undefined);
  assert.equal(second.fieldMeta?.maxBudget?.source, "user_confirmed");
});

test("stampChanges không bịa nguồn cho giá trị cũ không đổi", () => {
  const legacy = { ...base, maxBudget: 400_000 };
  const edited = { ...legacy, children: [{ ...legacy.children[0], weightKg: 11 }] };
  const stamped = stampChanges(legacy, edited, "user_entered", "2026-09-24T00:00:00.000Z");
  assert.deepEqual(Object.keys(stamped.fieldMeta ?? {}), [`children.${childId}.weightKg`]);
  assert.equal(stampChanges(legacy, legacy, "user_entered").fieldMeta, undefined);
});

test("đổi cân nặng qua chat được ghi nguồn user_entered", () => {
  const changed = parseProfileChange("Cập nhật Gold giờ nặng 11kg", base);
  assert.equal(changed?.children[0].weightKg, 11);
  assert.equal(changed?.fieldMeta?.[`children.${childId}.weightKg`]?.source, "user_entered");
  assert.equal(validProfile(changed), true);
});
