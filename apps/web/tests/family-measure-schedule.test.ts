import { test } from "node:test";
import assert from "node:assert/strict";
import { cadenceText, dueLine, intervalDays, measureDue, measurePush, sinceLast } from "../src/lib/family/measure-schedule.ts";
import { validProfile } from "../src/lib/experience/validate.ts";

const today = "2026-09-29";

test("cadence by age and family choice", () => {
  assert.deepEqual([0, 11, 12, 35, 36, 120].map((months) => intervalDays(months)), [30, 30, 61, 61, 182, 182]);
  assert.equal(intervalDays(undefined), 30);
  assert.equal(intervalDays(40, "monthly"), 30); assert.equal(intervalDays(2, "quarterly"), 91); assert.equal(intervalDays(2, "off"), null);
  assert.deepEqual([30, 61, 91, 182].map(cadenceText), ["mỗi tháng", "mỗi 2 tháng", "mỗi 3 tháng", "mỗi 6 tháng"]);
});

test("due, soon, ok — and height only once measured", () => {
  const never = measureDue({ ageMonths: 5, today })!;
  assert.deepEqual([never.state, never.what, never.nextDate, never.daysLeft], ["due", "weight", today, 0]);
  const overdue = measureDue({ ageMonths: 14, lastWeight: "2026-07-28", today })!;
  assert.deepEqual([overdue.state, overdue.what, overdue.daysLeft], ["due", "weight", -2]);
  assert.equal(dueLine(overdue, today), "Đến lịch cân — trễ 2 ngày");
  assert.equal(sinceLast(overdue, today), 63);
  const soon = measureDue({ ageMonths: 5, lastWeight: "2026-09-01", today })!;
  assert.deepEqual([soon.state, soon.daysLeft], ["soon", 2]);
  const ok = measureDue({ ageMonths: 42, lastWeight: "2026-09-02", today })!;
  assert.deepEqual([ok.state, ok.nextDate], ["ok", "2027-03-03"]);
  assert.equal(dueLine(ok, today), "Lần tới: cân 03/03/2027 · còn 155 ngày");
  // Weighed and measured together → both are asked for together.
  const both = measureDue({ ageMonths: 14, lastWeight: "2026-07-28", lastHeight: "2026-07-29", today })!;
  assert.equal(both.what, "both");
  // Height older than weight → height first.
  const height = measureDue({ ageMonths: 14, lastWeight: "2026-09-20", lastHeight: "2026-07-01", today })!;
  assert.deepEqual([height.what, height.state], ["height", "due"]);
  assert.equal(measureDue({ ageMonths: 14, today, every: "off" }), null);
});

test("push at most once a week, only when due", () => {
  const due = measureDue({ ageMonths: 14, lastWeight: "2026-07-28", today })!;
  const push = measurePush("c1", "Gold", due, today)!;
  assert.equal(push.title, "Đến lịch cân cho Gold"); assert.match(push.body, /63 ngày/); assert.match(push.body, /mỗi 2 tháng/);
  assert.equal(measurePush("c1", "Gold", due, today, "2026-09-25"), null);
  assert.ok(measurePush("c1", "Gold", due, today, "2026-09-22"));
  assert.equal(measurePush("c1", "Gold", measureDue({ ageMonths: 5, lastWeight: "2026-09-01", today }), today), null);
});

test("profile accepts the reminder setting", () => {
  const base = { id: "p", children: [], pricePreference: "value", aiConsent: true, updatedAt: "2026-09-29T00:00:00Z" };
  assert.equal(validProfile({ ...base, household: { measureEvery: "quarterly" } }), true);
  assert.equal(validProfile({ ...base, household: { measureEvery: "weekly" } }), false);
});
