import assert from "node:assert/strict";
import test from "node:test";
import { nowVn, todayVn } from "../src/lib/time/vn-date.ts";

test("todayVn: 00:00-07:00 giờ Việt Nam vẫn là ngày Việt Nam (server UTC lệch 1 ngày)", () => {
  // 2026-09-28T17:30Z = 2026-09-29 00:30 in Vietnam
  assert.equal(todayVn(new Date("2026-09-28T17:30:00Z")), "2026-09-29");
  assert.equal(todayVn(new Date("2026-09-28T16:59:59Z")), "2026-09-28");
  assert.equal(todayVn(new Date("2026-09-28T17:00:00Z")), "2026-09-29");
  assert.equal(todayVn(new Date("2026-09-29T06:59:00Z")), "2026-09-29");
  assert.equal(todayVn(new Date("2026-09-29T16:59:00Z")), "2026-09-29");
});

test("todayVn: qua tháng và qua năm", () => {
  assert.equal(todayVn(new Date("2026-09-30T18:00:00Z")), "2026-10-01");
  assert.equal(todayVn(new Date("2026-12-31T17:00:00Z")), "2027-01-01");
  assert.equal(todayVn(new Date("2028-02-28T17:00:00Z")), "2028-02-29");
});

test("nowVn: getter địa phương đọc giờ Việt Nam", () => {
  const vn = nowVn(new Date("2026-09-30T18:05:09Z"));
  assert.deepEqual([vn.getFullYear(), vn.getMonth() + 1, vn.getDate(), vn.getHours(), vn.getMinutes(), vn.getSeconds()], [2026, 10, 1, 1, 5, 9]);
  assert.equal(nowVn(new Date("2026-09-28T17:00:00Z")).getHours(), 0, "nửa đêm là 0, không phải 24");
});
