import assert from "node:assert/strict";
import test from "node:test";
import { dueEntries } from "../src/lib/money/fixed-items.ts";
import { recurringFor, shortVnd, summarizeMonth } from "../src/lib/money/summary.ts";
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

test("dự báo cuối tháng: tiền nhà đã ghi ngày 1 không bị nhân theo số ngày", () => {
  const early = new Date(2026, 8, 3, 10); // 03/09/2026 — day 3 of 30
  const rent = { id: "r-rent", name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 8_000_000, dayOfMonth: 1, active: true, lastPostedMonth: "2026-09" };
  const posted = { ...tx("2026-09-01", "expense", 8_000_000, "Gia đình"), recurringId: "r-rent", source: "recurring" as const };
  const items = [posted, tx("2026-09-02", "expense", 300_000, "Ăn uống")];
  const summary = summarizeMonth(bundle(items, { recurring: [rent] }), early);
  // 8,3tr spent + 300k/3 ngày × 27 ngày còn lại (not 8,3tr / 3 × 30 = 83tr).
  assert.equal(summary.expectedExpense, 8_300_000 + 2_700_000);
  assert.ok(!summary.insights.some((item) => item.id === "over-pace"), "không cảnh báo vượt kế hoạch");
  // A fixed item still to post adds its amount once.
  const internet = { id: "r-net", name: "Internet", category: "Tiêu dùng", kind: "expense" as const, amount: 450_000, dayOfMonth: 26, active: true };
  assert.equal(summarizeMonth(bundle(items, { recurring: [rent, internet, { ...internet, id: "r-off", active: false }, { ...internet, id: "r-in", kind: "income" as const }] }), early).expectedExpense, 11_450_000);
  // A one-off debt payment counts as spent but is not extrapolated.
  const withDebt = [...items, tx("2026-09-03", "expense", 6_000_000, "Tiền trả nợ")];
  assert.equal(summarizeMonth(bundle(withDebt, { recurring: [rent] }), early).expectedExpense, 14_300_000 + 2_700_000);
  // Genuinely fast flexible spending is still flagged.
  const fast = summarizeMonth(bundle([tx("2026-09-02", "expense", 3_000_000, "Ăn uống")]), early);
  assert.equal(fast.expectedExpense, 3_000_000 + 27_000_000);
  assert.ok(fast.insights.some((item) => item.id === "over-pace"));
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

test("khoản cố định: hỏi khi tới hạn, không tự ghi; khoản của tháng sau (ngày 1) chưa hỏi", () => {
  const recurring = [
    { id: "r1", name: "Internet", category: "Tiêu dùng", kind: "expense" as const, amount: 450_000, dayOfMonth: 26, active: true },
    { id: "r2", name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 8_000_000, dayOfMonth: 1, active: true },
    { id: "r3", name: "Lương", category: "Lương", kind: "income" as const, amount: 25_000_000, dayOfMonth: 6, active: true, lastPostedMonth: "2026-09" },
    { id: "r4", name: "Cũ", category: "Khác", kind: "expense" as const, amount: 1, dayOfMonth: 25, active: false },
  ];
  const summary = summarizeMonth(bundle([], { recurring }), now);
  // Rent (never answered, day 1 passed) is overdue; internet is asked two days ahead; salary is settled; the paused one is silent.
  assert.deepEqual(summary.due.map((d) => [d.name, d.state, d.period]), [["Tiền nhà", "overdue", "2026-09"], ["Internet", "due", "2026-09"]]);
  assert.deepEqual(summary.upcoming.map((item) => [item.name, item.daysLeft, item.dueOn]), [["Internet", 2, "2026-09-26"]]);
  assert.equal(summary.fixedDue, 8_450_000);
  // Answering a period (a paid record) takes it out of the list and off what is held back.
  const answered = summarizeMonth(bundle([], { recurring, periods: [{ recurringId: "r2", period: "2026-09", status: "paid" }] }), now);
  assert.deepEqual(answered.due.map((d) => d.name), ["Internet"]);
  assert.equal(answered.fixedDue, 450_000);
  // Past months have no due list.
  assert.deepEqual(summarizeMonth(bundle([], { month: "2026-08", recurring }), now).due, []);
});

test("còn tiêu được = kế hoạch − đã chi − khoản cố định chưa trả; kế hoạch = thu dự kiến − tiết kiệm; ngân sách nhóm chia theo mức chi quen", () => {
  const salary = { id: "sal", name: "Lương", category: "Lương", kind: "income" as const, amount: 25_000_000, dayOfMonth: 1, active: true, lastPostedMonth: "2026-09" };
  const rent = { id: "rent", name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 6_000_000, dayOfMonth: 1, active: true, lastPostedMonth: "2026-09" };
  const internet = { id: "net", name: "Internet", category: "Tiêu dùng", kind: "expense" as const, amount: 250_000, dayOfMonth: 26, active: true };
  const history = [
    { month: "2026-07", income: 25_000_000, expense: 4_000_000, saving: 0, byCategory: { "Ăn uống": 3_000_000, "Con": 1_000_000 } },
    { month: "2026-08", income: 25_000_000, expense: 4_000_000, saving: 0, byCategory: { "Ăn uống": 3_000_000, "Con": 1_000_000 } },
  ];
  const items = [tx("2026-09-05", "expense", 6_000_000, "Gia đình"), tx("2026-09-10", "expense", 1_000_000, "Ăn uống")];
  const settings = { openingCash: 0, openingSavings: 0, monthlyPlan: 12_000_000, monthlySaving: 5_000_000, categories: DEFAULT_CATEGORIES };
  const summary = summarizeMonth(bundle(items, { settings, recurring: [salary, rent, internet], history }), now);
  assert.equal(summary.plan, 20_000_000);
  assert.equal(summary.fixedDue, 250_000);
  assert.equal(summary.remainingOfPlan, 13_000_000);
  assert.equal(summary.freeToSpend, 20_000_000 - 7_000_000 - 250_000);
  // Flexible budget = plan − monthly fixed (6tr + 250k) = 13,75tr, shared 3:1 between Ăn uống and Con.
  const ăn = summary.budgetPlan.find((line) => line.category === "Ăn uống");
  const con = summary.budgetPlan.find((line) => line.category === "Con");
  assert.deepEqual([ăn?.source, con?.source], ["auto", "auto"]);
  assert.equal((ăn?.limit ?? 0) + (con?.limit ?? 0), 13_750_000);
  assert.equal(summary.byCategory.find((line) => line.category === "Ăn uống")?.limit, ăn?.limit);
  // Without a monthly saving the old behaviour holds: the typed plan, no shared budgets.
  const legacy = summarizeMonth(bundle(items, { settings: { ...settings, monthlySaving: undefined }, recurring: [salary, rent, internet], history }), now);
  assert.equal(legacy.plan, 12_000_000);
  assert.deepEqual(legacy.budgetPlan, []);
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

test("an entry marked Hằng tháng becomes a fixed item whose first period is next month", () => {
  const rec = recurringFor({ content: "Học phí mầm non", kind: "expense", category: "Học tập", amount: 3_500_000, occurredOn: "2026-09-05" }, 5, "r9");
  assert.deepEqual(rec, { id: "r9", name: "Học phí mầm non", kind: "expense", category: "Học tập", amount: 3_500_000, dayOfMonth: 5, active: true, lastPostedMonth: "2026-09" });
  assert.equal(dueEntries([rec], [], undefined, new Date(2026, 8, 24)).length, 0, "the entry itself answered September");
  assert.deepEqual(dueEntries([rec], [], undefined, new Date(2026, 9, 6)).map((d) => [d.period, d.state]), [["2026-10", "overdue"]]);
  assert.deepEqual(dueEntries([rec], [], undefined, new Date(2026, 9, 3)).map((d) => [d.period, d.state]), [["2026-10", "due"]]);
});
