import { test } from "node:test";
import assert from "node:assert/strict";
import { ageParts, ageText, bandFor, dayMilestone, growthPerMonth, nextBirthday, sizeOutlook, weightSeries } from "../src/lib/family/child-stats.ts";
import { adultMembers, adultName, childLook, withChildLook, withMembers } from "../src/lib/family/members.ts";
import { validWeightInput, validAvatarImage } from "../src/lib/family/validate.ts";
import { validProfile } from "../src/lib/experience/validate.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const CHILD = "11111111-1111-4111-8111-111111111111";
const base: FamilyProfile = { id: "p", children: [{ id: CHILD, name: "Gold", birthDate: "2025-07-20" }], pricePreference: "value", aiConsent: true, updatedAt: "2026-09-29T00:00:00Z", adultsCount: 2 };

test("age, day count and text", () => {
  const age = ageParts("2025-07-20", "2026-09-29");
  assert.deepEqual([age.years, age.months, age.days, age.totalMonths, age.dayNumber], [1, 2, 9, 14, 437]);
  assert.equal(ageText(age), "1 tuổi 2 tháng 9 ngày");
  assert.equal(ageText(ageParts("2023-03-12", "2026-09-29")), "3 tuổi 6 tháng");
  assert.equal(ageText(ageParts("2026-09-20", "2026-09-29")), "9 ngày tuổi");
  // Month-end: 31/01 → 28/02 is 1 month, → 01/03 is 1 month 1 day in a common year.
  assert.equal(ageText(ageParts("2026-01-31", "2026-02-28")), "1 tháng");
  assert.equal(ageText(ageParts("2026-01-31", "2026-03-01")), "1 tháng 1 ngày");
});

test("next birthday, progress and 29/02", () => {
  const b = nextBirthday("2025-07-20", "2026-09-29");
  assert.equal(b.date, "2027-07-20"); assert.equal(b.daysLeft, 294); assert.equal(b.turning, 2);
  assert.ok(b.progress > 0.19 && b.progress < 0.2);
  const today = nextBirthday("2025-07-20", "2026-07-20");
  assert.equal(today.isToday, true); assert.equal(today.turning, 1);
  assert.equal(nextBirthday("2024-02-29", "2026-01-10").date, "2026-02-28");
  // First year: progress counts from birth.
  assert.ok(Math.abs(nextBirthday("2026-01-01", "2026-07-02").progress - 182 / 365) < 1e-9);
});

test("day milestones", () => {
  assert.deepEqual(dayMilestone("2025-07-20", "2026-09-29"), { day: 500, date: "2026-12-01", daysLeft: 63, isToday: false });
  assert.equal(dayMilestone("2025-07-20", "2026-12-01")?.isToday, true);
});

test("weight series merges the profile weight only when newer", () => {
  const log = [{ date: "2026-05-01", kg: 9 }, { date: "2026-07-01", kg: 9.8 }, { date: "2026-07-01", kg: 9.9 }];
  assert.deepEqual(weightSeries(log, { kg: 10.5, date: "2026-09-01" }).map((p) => p.kg), [9, 9.9, 10.5]);
  assert.deepEqual(weightSeries(log, { kg: 9.9, date: "2026-06-01" }).map((p) => p.kg), [9, 9.9]);
  assert.deepEqual(weightSeries([], { kg: 7 }), []);
  // Same weight re-saved later (profile updatedAt moved on) is not a new weighing.
  assert.deepEqual(weightSeries(log, { kg: 9.9, date: "2026-09-20" }).map((p) => p.date), ["2026-05-01", "2026-07-01"]);
});

test("growth pace and size outlook", () => {
  const series = [{ date: "2026-06-01", kg: 9 }, { date: "2026-07-01", kg: 9.5 }, { date: "2026-07-31", kg: 10 }];
  const pace = growthPerMonth(series)!;
  assert.ok(Math.abs(pace - 0.5) < 0.01);
  const outlook = sizeOutlook(series, pace)!;
  assert.equal(outlook.size, "L"); assert.equal(outlook.nextSize, "XL"); assert.equal(outlook.kgToGo, 2);
  assert.equal(outlook.onDate, "2026-11-28");
  assert.equal(growthPerMonth([{ date: "2026-07-01", kg: 9 }, { date: "2026-07-05", kg: 9.2 }]), null);
  assert.equal(sizeOutlook([{ date: "2026-07-01", kg: 16 }], null)?.nextSize, undefined);
  assert.equal(bandFor(12).size, "XL"); assert.equal(bandFor(4.9).size, "NB/S");
});

test("members: placeholders, names, looks, adultsCount follows the list", () => {
  assert.deepEqual(adultMembers(base).map((m) => m.id), ["me", "adult-2"]);
  assert.equal(adultName({ id: "me" }, 0, "Dũng"), "Dũng");
  assert.equal(adultName({ id: "m-1", role: "mom" }, 1), "Mẹ");
  const three = withMembers(base, [{ id: "me", role: "dad" }, { id: "m-a", role: "mom", emoji: "👩", color: "rose" }, { id: "m-b", role: "grandma" }]);
  assert.equal(three.adultsCount, 3);
  assert.equal(childLook(base, base.children[0], 0).color, "sunset");
  const looked = withChildLook(three, CHILD, { emoji: "🐻", color: "mint" });
  assert.deepEqual(childLook(looked, looked.children[0], 0), { color: "mint", emoji: "🐻" });
  assert.equal(validProfile({ ...looked, household: { ...looked.household, motto: "Nhà là nơi để về", theme: "garden" } }), true);
});

test("validation rejects bad members, looks and inputs", () => {
  const bad = (household: unknown) => validProfile({ ...base, household });
  assert.equal(bad({ members: [] }), false);
  assert.equal(bad({ members: [{ id: "Me!" }] }), false);
  assert.equal(bad({ members: [{ id: "me" }, { id: "me" }] }), false);
  assert.equal(bad({ members: [{ id: "me", emoji: "abc" }] }), false);
  assert.equal(bad({ looks: { [CHILD]: { color: "neon" } } }), false);
  assert.equal(bad({ looks: { "not-a-uuid": {} } }), false);
  assert.equal(bad({ theme: "disco" }), false);
  const now = new Date("2026-09-29T05:00:00Z");
  assert.equal(validWeightInput({ childId: CHILD, date: "2026-09-29", kg: 10.4 }, now), true);
  assert.equal(validWeightInput({ childId: CHILD, date: "2026-10-05", kg: 10.4 }, now), false);
  assert.equal(validWeightInput({ childId: CHILD, date: "2026-09-29", kg: 45 }, now), false);
  assert.equal(validAvatarImage("data:image/png;base64,AAAA"), false);
  assert.equal(validAvatarImage("data:image/jpeg;base64,AAAA"), true);
});
