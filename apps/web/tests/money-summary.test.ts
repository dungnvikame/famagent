import assert from "node:assert/strict";
import test from "node:test";
import { dueRecurring, postingFor, recurringFor, shortVnd, summarizeMonth, upcomingRecurring } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyTransaction } from "../src/lib/money/types.ts";
import { validGoal, validRecurring, validSettings, validTransaction } from "../src/lib/money/validate.ts";

const now = new Date(2026, 8, 24, 10); // 24/09/2026 — day 24 of 30
let n = 0;
const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category: string, forChild = false): MoneyTransaction => ({ id: `t${++n}`, occurredOn, content: category, category, kind, amount, forChild, source: "manual" });
const bundle = (transactions: MoneyTransaction[], patch: Partial<MoneyBundle> = {}): MoneyBundle => ({
  month: "2026-09", settings: { openingCash: 1_000_000, openingSavings: 20_000_000, monthlyPlan: 25_000_000, categories: DEFAULT_CATEGORIES },
  transactions, totals: { income: 0, expense: 0, saving: 0 }, budgets: [], recurring: [], goals: [], ...patch,
});

test("tổng tháng, nhịp chi và số dư suy ra từ số dư đầu kỳ", () => {
  const items = [tx("2026-09-06", "income", 25_000_000, "Lương"), tx("2026-09-06", "expense", 5_000_000, "Gia đình"), tx("2026-09-10", "expense", 1_000_000, "Ăn uống"), tx("2026-09-06", "saving", 5_000_000, "Tiết kiệm cho con", true), tx("2026-08-30", "expense", 999, "Ăn uống")];
  const summary = summarizeMonth(bundle(items, { totals: { income: 25_000_000, expense: 6_000_999, saving: 5_000_000 } }), now);
  assert.equal(summary.income, 25_000_000); assert.equal(summary.expense, 6_000_000); assert.equal(summary.saving, 5_000_000);
  assert.equal(summary.net, 14_000_000); assert.equal(summary.transactionCount, 4);
  assert.equal(summary.expectedExpense, Math.round(6_000_000 / 24 * 30));
  assert.equal(summary.remainingOfPlan, 19_000_000);
  assert.deepEqual(summary.balances, { cash: 1_000_000 + 25_000_000 - 6_000_999 - 5_000_000, savings: 25_000_000 });
  assert.ok(summary.insights.some((item) => item.id === "under-pace"), "chi chậm hơn kế hoạch → insight tốt");
  assert.ok(summary.insights.some((item) => item.id === "saving-rate"));
});

test("vượt nhịp kế hoạch: cảnh báo kèm nhóm vượt ngân sách; chi cho con ≥25% được nêu", () => {
  const items = [tx("2026-09-02", "expense", 13_000_000, "Ăn uống"), tx("2026-09-03", "expense", 9_000_000, "Con", true)];
  const summary = summarizeMonth(bundle(items, { budgets: [{ id: "b1", category: "Ăn uống", month: "2026-09", limitAmount: 5_000_000 }] }), now);
  assert.equal(summary.byCategory[0].category, "Ăn uống"); assert.equal(summary.byCategory[0].ratio, 2.6);
  assert.equal(summary.expectedExpense, 27_500_000); assert.equal(summary.paceRatio, 1.1);
  const over = summary.insights.find((item) => item.id === "over-pace");
  assert.ok(over && /cao hơn kế hoạch 25\.000\.000đ khoảng 10%/.test(over.text) && /Ăn uống \(\+8\.000\.000đ\)/.test(over.text), over?.text);
  assert.ok(summary.insights.some((item) => item.id === "child-share" && /41%/.test(item.text)));
});

test("tháng đã qua: không dự báo nhịp, không có khoản sắp tới", () => {
  const summary = summarizeMonth(bundle([tx("2026-08-10", "expense", 100_000, "Ăn uống")], { month: "2026-08", recurring: [{ id: "r1", name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450_000, dayOfMonth: 26, active: true }] }), now);
  assert.equal(summary.expectedExpense, undefined); assert.equal(summary.upcoming.length, 0); assert.equal(summary.expense, 100_000);
});

test("khoản định kỳ: sắp tới trong 7 ngày (kể cả đầu tháng sau), đến hạn thì tự ghi một lần mỗi tháng", () => {
  const recurring = [
    { id: "r1", name: "Internet", category: "Tiêu dùng", kind: "expense" as const, amount: 450_000, dayOfMonth: 26, active: true },
    { id: "r2", name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 8_000_000, dayOfMonth: 1, active: true },
    { id: "r3", name: "Lương", category: "Lương", kind: "income" as const, amount: 25_000_000, dayOfMonth: 6, active: true, lastPostedMonth: "2026-09" },
    { id: "r4", name: "Cũ", category: "Khác", kind: "expense" as const, amount: 1, dayOfMonth: 25, active: false },
  ];
  const upcoming = upcomingRecurring(recurring, now);
  assert.deepEqual(upcoming.map((item) => [item.name, item.daysLeft, item.dueOn]), [["Internet", 2, "2026-09-26"], ["Tiền nhà", 7, "2026-10-01"]]);
  assert.deepEqual(dueRecurring(recurring, "2026-09", now).map((item) => item.id), ["r2"], "chỉ khoản đã tới ngày và chưa ghi tháng này");
  assert.deepEqual(dueRecurring(recurring, "2026-10", now), [], "không ghi trước cho tháng sau");
  const posted = postingFor(recurring[1], "2026-09", "p1");
  assert.equal(posted.occurredOn, "2026-09-01"); assert.equal(posted.source, "recurring"); assert.equal(posted.recurringId, "r2");
  assert.equal(postingFor({ ...recurring[0], dayOfMonth: 31 }, "2026-09", "p2").occurredOn, "2026-09-30", "ngày 31 lùi về cuối tháng");
});

test("validate: chi âm bị từ chối, tiết kiệm âm hợp lệ (rút), số dạng chuỗi được nhận", () => {
  assert.equal(validTransaction({ occurredOn: "2026-09-01", content: "Ăn sáng", category: "Ăn uống", kind: "expense", amount: -30_000 }), null);
  const saving = validTransaction({ occurredOn: "2026-09-04", content: "Rút tiết kiệm", category: "Rút tiết kiệm", kind: "saving", amount: "-698000", forChild: "yes" });
  assert.ok(saving); assert.equal(saving.amount, -698_000); assert.equal(saving.forChild, false); assert.equal(saving.source, "manual");
  assert.equal(validTransaction({ occurredOn: "2026-13-01", content: "x", category: "y", kind: "income", amount: 1 }), null);
  assert.ok(validRecurring({ name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450000, dayOfMonth: 26 }));
  assert.equal(validRecurring({ name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450000, dayOfMonth: 32 }), null);
  assert.ok(validGoal({ name: "Quỹ dự phòng", targetAmount: 100_000_000, monthlyPlan: "" }));
  assert.equal(validSettings({ categories: [{ name: "", kind: "expense" }] }), null);
  assert.deepEqual(validSettings({ categories: [] }), { openingCash: 0, openingSavings: 0, monthlyPlan: undefined, categories: [], position: undefined, allocation: undefined, categoryMemory: undefined });
});

test("shortVnd", () => { assert.equal(shortVnd(18_200_000), "18,2M"); assert.equal(shortVnd(450_000), "450K"); assert.equal(shortVnd(-698_000), "−698K"); assert.equal(shortVnd(17), "17đ"); });

test("recurring items post forward only: no back-fill, no double post when switching months", () => {
  const now = new Date(2026, 8, 24, 10);
  const item = { id: "r1", name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 6_000_000, dayOfMonth: 1, active: true };
  assert.equal(dueRecurring([item], "2026-09", now).length, 1);
  assert.equal(dueRecurring([item], "2026-07", now).length, 0);
  const posted = { ...item, lastPostedMonth: "2026-09" };
  assert.equal(dueRecurring([posted], "2026-08", now).length, 0);
  assert.equal(dueRecurring([posted], "2026-09", now).length, 0);
  assert.equal(dueRecurring([{ ...item, lastPostedMonth: "2026-08" }], "2026-09", now).length, 1);
});

test("an entry marked Hằng tháng becomes a recurring item that starts next month", () => {
  const rec = recurringFor({ content: "Học phí mầm non", kind: "expense", category: "Học tập", amount: 3_500_000, occurredOn: "2026-09-05" }, 5, "r9");
  assert.deepEqual(rec, { id: "r9", name: "Học phí mầm non", kind: "expense", category: "Học tập", amount: 3_500_000, dayOfMonth: 5, active: true, lastPostedMonth: "2026-09" });
  assert.equal(dueRecurring([rec], "2026-09", new Date(2026, 8, 24)).length, 0);
  assert.equal(dueRecurring([rec], "2026-10", new Date(2026, 9, 6)).length, 1);
});
