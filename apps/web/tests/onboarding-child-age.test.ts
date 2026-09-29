import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { childAgeMonths, childRow, profileFromRow } from "../src/lib/experience/profile-mapper.ts";
import { saveProfileForUser } from "../src/lib/experience/profile-store.ts";
import type { ChildProfile, FamilyProfile } from "../src/lib/experience/types.ts";
import { INPUT_BIRTH_YEARS, validBirthDate, validProfile } from "../src/lib/experience/validate.ts";
import { AGE_CHOICES, buildQuestions } from "../src/lib/onboarding/questions.ts";

const childId = "11111111-1111-4111-8111-111111111111";
const blank = (): FamilyProfile => ({ id: "p1", children: [{ id: childId }], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-03-29T00:00:00Z" });
const pickAge = (profile: FamilyProfile, value: string, at: Date): FamilyProfile => {
  const question = buildQuestions(profile, () => childId, at.getTime()).find((item) => item.id === `child-age:${childId}`);
  assert.ok(question);
  return question!.apply(profile, [value]);
};

test("“Dưới 1 tuổi” chọn 6 tháng trước, nay đọc là 12 tháng", () => {
  const picked = pickAge(blank(), "0-12", new Date("2026-03-29T05:00:00Z"));
  const child = picked.children[0];
  assert.equal(child.ageMonths, 6);
  assert.equal(child.ageAsOf, "2026-03-29");
  assert.equal(childAgeMonths(child, new Date("2026-03-29T09:00:00Z")), 6);
  assert.equal(childAgeMonths(child, new Date("2026-09-29T09:00:00Z")), 12);
  assert.equal(childAgeMonths(child, new Date("2026-09-28T09:00:00Z")), 11, "chưa tròn tháng thì chưa tính");
  assert.ok(validProfile(picked));
});

test("ngày ghi theo giờ Việt Nam: chọn lúc 2h sáng không lùi về hôm trước", () => {
  const picked = pickAge(blank(), "12-36", new Date("2026-03-28T19:00:00Z"));
  assert.equal(picked.children[0].ageAsOf, "2026-03-29");
});

test("hồ sơ cũ không có ageAsOf giữ nguyên số tháng; ngày sinh vẫn được ưu tiên", () => {
  const now = new Date("2030-01-01T00:00:00Z");
  assert.equal(childAgeMonths({ id: childId, ageMonths: 24 }, now), 24);
  assert.equal(childAgeMonths({ id: childId }, now), undefined);
  assert.equal(childAgeMonths({ id: childId, ageAsOf: "2026-03-29" }, now), undefined);
  assert.equal(childAgeMonths({ id: childId, birthDate: "2025-07-10", ageMonths: 3, ageAsOf: "2026-03-29" }, new Date("2026-09-23T00:00:00Z")), 14);
});

test("tuổi không vượt 18 năm và ageAsOf hỏng thì bỏ qua", () => {
  assert.equal(childAgeMonths({ id: childId, ageMonths: 168, ageAsOf: "2020-01-01" }, new Date("2030-01-01T00:00:00Z")), 216);
  assert.equal(childAgeMonths({ id: childId, ageMonths: 24, ageAsOf: "2026-02-31" }, new Date("2026-09-29T00:00:00Z")), 24);
  assert.equal(childAgeMonths({ id: childId, ageMonths: 24, ageAsOf: "2027-01-01" }, new Date("2026-09-29T00:00:00Z")), 24, "ngày ở tương lai không làm giảm tuổi");
});

test("chọn lại khoảng tuổi đặt lại mốc; khoảng của onboarding hiện đúng theo thời gian", () => {
  let profile = pickAge(blank(), "0-12", new Date("2026-03-29T05:00:00Z"));
  const current = (at: Date) => buildQuestions(profile, () => childId, at.getTime()).find((item) => item.id === `child-age:${childId}`)!.current(profile);
  assert.deepEqual(current(new Date("2026-03-30T00:00:00Z")), ["0-12"]);
  assert.deepEqual(current(new Date("2026-09-29T00:00:00Z")), ["12-36"], "12 tháng đã sang khoảng 1–3 tuổi");
  profile = pickAge(profile, "72-144", new Date("2026-09-29T00:00:00Z"));
  assert.equal(profile.children[0].ageAsOf, "2026-09-29");
  assert.equal(profile.children[0].ageMonths, AGE_CHOICES.find((choice) => choice.value === "72-144")!.months);
});

test("Supabase: ageAsOf đi qua row; row cũ không có cột vẫn map như trước", () => {
  const child: ChildProfile = { id: childId, name: "Gold", ageMonths: 6, ageAsOf: "2026-03-29" };
  const row = childRow(child, "p1", 0, "2026-03-29T00:00:00Z");
  assert.equal(row.age_as_of, "2026-03-29");
  assert.equal(profileFromRow({ id: "p1", price_preference: "balanced", ai_consent: false, updated_at: "x", children: [row] }).children[0].ageAsOf, "2026-03-29");
  assert.equal(childRow({ id: childId, birthDate: "2025-07-10" }, "p1", 0, "x").age_as_of, null);
  const legacy = profileFromRow({ id: "p1", price_preference: "balanced", ai_consent: false, updated_at: "x", children: [{ id: childId, age_months: 24, position: 0 }] }).children[0];
  assert.equal("ageAsOf" in legacy, false);
  assert.equal(legacy.ageMonths, 24);
});

test("kiểm tra hợp lệ: ageAsOf, 216 tháng và ngày sinh tới 18 năm", () => {
  const withChild = (patch: object): FamilyProfile => ({ ...blank(), children: [{ id: childId, ...patch }] });
  assert.ok(validProfile(withChild({ ageMonths: 168, ageAsOf: "2026-09-29" })));
  assert.ok(validProfile(withChild({ ageMonths: 216 })));
  assert.equal(validProfile(withChild({ ageMonths: 217 })), false);
  assert.equal(validProfile(withChild({ ageAsOf: "29/09/2026" })), false);
  assert.equal(validProfile(withChild({ ageAsOf: "2026-02-31" })), false);
  assert.equal(INPUT_BIRTH_YEARS, 18);
  assert.equal(validBirthDate("2010-01-01", new Date("2026-09-29T00:00:00Z"), INPUT_BIRTH_YEARS), true);
  assert.equal(validBirthDate("2005-01-01", new Date("2026-09-29T00:00:00Z"), INPUT_BIRTH_YEARS), false);
});

test("lưu hồ sơ trước khi có cột age_as_of: thử lại không có cột, không mất bé", async () => {
  const attempts: Array<Array<Record<string, unknown>>> = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        upsert: (rows: Array<Record<string, unknown>>) => {
          if (table === "children") {
            attempts.push(rows);
            return Promise.resolve({ error: "age_as_of" in rows[0] ? { message: "Could not find the 'age_as_of' column of 'children' in the schema cache" } : null });
          }
          return chain;
        },
        select: () => chain, single: () => Promise.resolve({ data: { id: "fam-1" }, error: null }),
        eq: () => Promise.resolve({ data: [], error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const profile: FamilyProfile = { ...blank(), children: [{ id: childId, ageMonths: 6, ageAsOf: "2026-03-29" }] };
  assert.equal(await saveProfileForUser(client, "u1", profile), null);
  assert.equal(attempts.length, 2);
  assert.equal("age_as_of" in attempts[1][0], false);
  assert.equal(attempts[1][0].age_months, 6);
});
