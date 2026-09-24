import assert from "node:assert/strict";
import test from "node:test";
import { dailyTasks, dayIndex, streak } from "../src/lib/brief/daily-tasks.ts";
import type { FamilyProfile, HouseholdContext } from "../src/lib/experience/types.ts";

const base = (household: HouseholdContext, ages: number[] = [9]): FamilyProfile => ({ id: "p", pricePreference: "balanced", aiConsent: true, updatedAt: "x", household, children: ages.map((ageMonths, index) => ({ id: `0000000${index}-0000-4000-8000-000000000000`, ageMonths })) });
const wed = new Date(2026, 8, 23, 9); // Wednesday
const sun = new Date(2026, 8, 27, 9); // Sunday

test("chưa chọn phương pháp và không có vấn đề → không có việc", () => {
  assert.deepEqual(dailyTasks(base({}), wed), []);
});

test("phương pháp nuôi dạy: mỗi ngày một việc, xoay vòng 3 việc", () => {
  const ids = [0, 1, 2, 3].map((offset) => dailyTasks(base({ careMethod: "easy" }), new Date(wed.getTime() + offset * 86_400_000))[0].id);
  assert.equal(new Set(ids.slice(0, 3)).size, 3);
  assert.equal(ids[3], ids[0]);
  assert.match(dailyTasks(base({ careMethod: "easy" }), wed)[0].source, /E\.A\.S\.Y/);
  assert.deepEqual(dailyTasks(base({ careMethod: "easy", setup: "no_kids" }, []), wed), [], "không có con thì không nhắc việc nuôi dạy");
});

test("phương pháp tiền: ngày thường nhắc ghi chi (ẩn khi đã ghi), Chủ nhật là việc hằng tuần", () => {
  assert.equal(dailyTasks(base({ moneyMethod: "kakeibo" }), wed)[0].id, "money:kakeibo:log");
  assert.deepEqual(dailyTasks(base({ moneyMethod: "kakeibo" }), wed, { loggedToday: true }), []);
  const weekly = dailyTasks(base({ moneyMethod: "kakeibo" }), sun)[0];
  assert.equal(weekly.id, "money:kakeibo:weekly"); assert.match(weekly.title, /4 câu Kakeibo/);
  assert.match(dailyTasks(base({ moneyMethod: "baby-steps", emergency: "none" }), sun)[0].title, /Bước 1/);
});

test("việc cải thiện tuần: lấy từ đánh giá chăm con trước, đổi mỗi tuần, giữ nguyên trong tuần", () => {
  const h: HouseholdContext = { careDeepDive: true, sleepQuality: "short", screenTime: "gt2h", monthlyIncome: 20_000_000, monthlySpend: 19_000_000, monthlyDebt: 0 };
  const task = (date: Date) => dailyTasks(base(h), date).find((item) => item.kind === "improve")!;
  assert.equal(task(wed).source, "Việc cải thiện tuần này");
  const sameWeek = new Date(wed.getTime() + 86_400_000);
  if (Math.floor(dayIndex(sameWeek) / 7) === Math.floor(dayIndex(wed) / 7)) assert.equal(task(sameWeek).id, task(wed).id);
  assert.notEqual(task(new Date(wed.getTime() + 7 * 86_400_000)).id, task(wed).id);
});

test("mọi id việc đều hợp lệ với API đồng bộ (/api/routine)", async () => {
  const { TASK_ID } = await import("../src/lib/brief/daily-tasks.ts");
  const methods = ["easy", "rie", "montessori", "positive-discipline", "emotion-coaching", "french"] as const;
  const money = ["jars", "50-30-20", "pay-first", "zero-based", "kakeibo", "baby-steps"] as const;
  const h: HouseholdContext = { careDeepDive: true, sleepQuality: "short", safety: ["none"], monthlyIncome: 20_000_000, monthlySpend: 25_000_000, emergency: "none", longTermSavings: ["none"] };
  for (let day = 0; day < 14; day++) for (let i = 0; i < methods.length; i++) {
    const date = new Date(wed.getTime() + day * 86_400_000);
    for (const task of dailyTasks(base({ ...h, careMethod: methods[i], moneyMethod: money[i] }), date)) assert.match(task.id, TASK_ID, task.id);
  }
});

test("chuỗi ngày: tính đến hôm nay, hoặc hôm qua nếu hôm nay chưa làm", () => {
  assert.equal(streak({ "2026-09-21": ["a"], "2026-09-22": ["a"], "2026-09-23": ["b"] }, wed), 3);
  assert.equal(streak({ "2026-09-21": ["a"], "2026-09-22": ["a"] }, wed), 2);
  assert.equal(streak({ "2026-09-20": ["a"], "2026-09-22": [] }, wed), 0);
});
