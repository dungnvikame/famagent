import assert from "node:assert/strict";
import test from "node:test";
import { dueEntries, expectedAmount, fixedStillDue, matchDue, mergePeriods, periodsFromEntries, recurringAmountsFrom, windowIn, windowLabel } from "../src/lib/money/fixed-items.ts";
import { budgetLines, cashflow, effectivePlan, fixedMonthly, flexibleBudget, flexibleCategories, plannedIncome, setAsideMonthly } from "../src/lib/money/plan.ts";
import { DEFAULT_CATEGORIES, type MoneyRecurring, type RecurringPeriod } from "../src/lib/money/types.ts";

const item = (over: Partial<MoneyRecurring> & Pick<MoneyRecurring, "id" | "name">): MoneyRecurring => ({ category: "Tiêu dùng", kind: "expense", amount: 100_000, dayOfMonth: 1, active: true, ...over });
const salary = item({ id: "salary", name: "Lương", kind: "income", category: "Lương", amount: 25_000_000, dayOfMonth: 1, schedule: { kind: "range", to: 5 } });
const rent = item({ id: "rent", name: "Tiền nhà", category: "Gia đình", amount: 6_000_000, dayOfMonth: 1 });
const power = item({ id: "power", name: "Tiền điện", category: "Tiền điện", amount: 600_000, dayOfMonth: 5, schedule: { kind: "range", to: 12 }, amountMode: "estimate" });
const net = item({ id: "net", name: "Internet", amount: 250_000, dayOfMonth: 26, schedule: { kind: "range", to: 30 }, amountMode: "estimate" });
const car = item({ id: "car", name: "Trả góp xe", category: "Tiền trả góp", amount: 4_500_000, dayOfMonth: 30 });
const school = item({ id: "school", name: "Học phí quý 4", category: "Học tập", amount: 9_000_000, dayOfMonth: 1, schedule: { kind: "quarter", to: 10 } });
const insurance = item({ id: "ins", name: "Bảo hiểm nhân thọ", category: "Khác", amount: 12_000_000, dayOfMonth: 15, schedule: { kind: "year", month: 12 } });
const all = [salary, rent, power, net, car, school, insurance];
const today = new Date(2026, 8, 29);
const paid = (recurringId: string, period: string): RecurringPeriod => ({ recurringId, period, status: "paid" });

test("windows: clamp to the month, ranges, end of month, quarter and year months", () => {
  assert.deepEqual(windowIn({ dayOfMonth: 31 }, "2026-09"), { from: 30, to: 30 });
  assert.deepEqual(windowIn(power, "2026-09"), { from: 5, to: 12 });
  assert.deepEqual(windowIn({ dayOfMonth: 1, schedule: { kind: "eom" } }, "2026-02"), { from: 28, to: 28 });
  assert.equal(windowIn(school, "2026-09"), null);
  assert.deepEqual(windowIn(school, "2026-10"), { from: 1, to: 10 });
  assert.equal(windowIn(insurance, "2026-11"), null);
  assert.deepEqual(windowIn(insurance, "2026-12"), { from: 15, to: 15 });
  assert.equal(windowLabel(power, "2026-09"), "5–12");
  assert.equal(windowLabel(car, "2026-09"), "ngày 30");
  assert.equal(windowLabel({ dayOfMonth: 1, schedule: { kind: "eom" } }, "2026-09"), "cuối tháng");
});

test("due entries on 29/9: internet and the instalment are asked now, tuition is coming up, answered ones are gone", () => {
  const periods = [paid("salary", "2026-09"), paid("rent", "2026-09"), paid("power", "2026-09")];
  const due = dueEntries(all, periods, { net: [250_000, 250_000, 260_000] }, today);
  assert.deepEqual(due.map((d) => [d.recurringId, d.state, d.period, d.label]), [
    ["net", "due", "2026-09", "26–30"],
    ["car", "due", "2026-09", "ngày 30"],
    ["school", "soon", "2026-10", "1–10"],
  ]);
  assert.equal(due[0].amount, 253_333);
  assert.equal(due[0].estimated, true);
  assert.equal(due[1].estimated, false);
  assert.equal(due[2].daysToStart, 2);
});

test("a window that passed without an answer is overdue; a skip or a settled month hides it", () => {
  const stale = { ...power, lastPostedMonth: "2026-08" };
  assert.deepEqual(dueEntries([stale], [], undefined, today).map((d) => [d.period, d.state]), [["2026-09", "overdue"]]);
  assert.deepEqual(dueEntries([stale], [{ recurringId: "power", period: "2026-09", status: "skipped" }], undefined, today), []);
  assert.deepEqual(dueEntries([{ ...stale, lastPostedMonth: "2026-09" }], [], undefined, today), []);
  // Missed months are chased for three months back, not forever (next month's rent is not asked yet).
  const long = dueEntries([{ ...rent, lastPostedMonth: "2026-01" }], [], undefined, today).map((d) => `${d.period}:${d.state}`);
  assert.deepEqual(long, ["2026-06:overdue", "2026-07:overdue", "2026-08:overdue", "2026-09:overdue"]);
  // Never settled: asking starts with the current month, not the past.
  assert.deepEqual(dueEntries([rent], [], undefined, today).map((d) => d.period), ["2026-09"]);
});

test("paused items never ask; tuition on 1/10 shows up two days ahead but not two weeks ahead", () => {
  assert.deepEqual(dueEntries([{ ...net, active: false }], [], undefined, today), []);
  assert.equal(dueEntries([school], [], undefined, new Date(2026, 8, 12)).length, 0);
  assert.equal(dueEntries([school], [], undefined, new Date(2026, 8, 24)).length, 1);
});

test("estimate: average of the last three paid amounts, the set amount before any", () => {
  assert.deepEqual(expectedAmount(power, { power: [640_000, 588_000, 608_000, 999_000] }), { amount: 612_000, estimated: true });
  assert.deepEqual(expectedAmount(power, {}), { amount: 600_000, estimated: true });
  assert.deepEqual(expectedAmount(rent, { rent: [1] }), { amount: 6_000_000, estimated: false });
});

test("still due this month: unanswered expenses at their expected amount, even before the window opens", () => {
  const periods = [paid("rent", "2026-09"), paid("power", "2026-09")];
  assert.equal(fixedStillDue(all, periods, undefined, "2026-09"), 250_000 + 4_500_000);
  assert.equal(fixedStillDue(all, periods, undefined, "2026-10"), 6_000_000 + 600_000 + 250_000 + 4_500_000 + 9_000_000);
  assert.equal(fixedStillDue([{ ...car, lastPostedMonth: "2026-09" }], [], undefined, "2026-09"), 0);
});

test("ledger entries answer their period; records win; amounts come newest first", () => {
  const entries = [
    { recurringId: "power", occurredOn: "2026-07-08", amount: 588_000 }, { recurringId: "power", occurredOn: "2026-08-09", amount: 640_000 },
    { recurringId: "power", occurredOn: "2026-09-08", amount: 608_000 }, { recurringId: "power", occurredOn: "2026-09-20", amount: 50_000 }, { amount: 5, occurredOn: "2026-09-01" },
  ];
  const fromEntries = periodsFromEntries(entries);
  assert.deepEqual(fromEntries.map((p) => p.period), ["2026-07", "2026-08", "2026-09"]);
  const merged = mergePeriods([{ recurringId: "power", period: "2026-08", status: "skipped" }], fromEntries);
  assert.equal(merged.find((p) => p.period === "2026-08")?.status, "skipped");
  assert.equal(merged.length, 3);
  assert.deepEqual(recurringAmountsFrom(entries), { power: [50_000, 608_000, 640_000] });
});

test("typed entries find the period they answer", () => {
  const due = dueEntries(all, [paid("rent", "2026-09")], undefined, today);
  assert.equal(matchDue(due, { content: "trả góp xe 4,5tr", kind: "expense" })?.recurringId, "car");
  assert.equal(matchDue(due, { content: "internet 260k", kind: "expense" })?.recurringId, "net");
  assert.equal(matchDue(due, { content: "đóng học phí 9tr", kind: "expense" })?.recurringId, "school");
  assert.equal(matchDue(due, { content: "internet 260k", kind: "income" }), null);
  assert.equal(matchDue(due, { content: "ăn sáng", kind: "expense" }), null);
  // No name in common: the only waiting item of that category with a close amount.
  assert.equal(matchDue(due, { content: "chuyển khoản ngân hàng", kind: "expense", category: "Tiền trả góp", amount: 4_400_000 })?.recurringId, "car");
  assert.equal(matchDue(due, { content: "chuyển khoản ngân hàng", kind: "expense", category: "Tiền trả góp", amount: 1_000_000 }), null);
});

test("plan: income − saving when the family saves monthly, else the typed plan", () => {
  assert.equal(plannedIncome(all, "2026-09"), 25_000_000);
  assert.equal(effectivePlan({ monthlySaving: 5_000_000, monthlyPlan: 12_000_000 }, all, "2026-09"), 20_000_000);
  assert.equal(effectivePlan({ monthlyPlan: 12_000_000 }, all, "2026-09"), 12_000_000);
  assert.equal(effectivePlan({ monthlySaving: 5_000_000, monthlyPlan: 12_000_000 }, [rent], "2026-09"), 12_000_000);
  assert.equal(effectivePlan({}, [rent], "2026-09"), undefined);
  assert.equal(effectivePlan({ monthlySaving: 30_000_000 }, all, "2026-09"), 0);
});

test("fixed monthly vs set aside: quarter and year items are spread, not counted in the month", () => {
  assert.equal(fixedMonthly(all), 6_000_000 + 600_000 + 250_000 + 4_500_000);
  assert.equal(setAsideMonthly(all), 3_000_000 + 1_000_000);
  assert.equal(flexibleBudget(20_000_000, all), 20_000_000 - 11_350_000);
  assert.equal(flexibleBudget(5_000_000, all), 0);
});

test("category budgets: set ones stay, the rest share the flexible budget by usual spend, total matches", () => {
  const names = flexibleCategories(DEFAULT_CATEGORIES, all);
  assert.ok(!names.includes("Tiền điện") && !names.includes("Tiền trả góp") && !names.includes("Tiền cho vay") && !names.includes("Gia đình"));
  assert.ok(names.includes("Ăn uống"));
  const averages = { "Ăn uống": 3_000_000, "Con": 1_000_000, "Mua sắm": 1_000_000, "Giải trí": 0 };
  const lines = budgetLines(8_650_000, averages, names, { "Con": 1_500_000 });
  assert.deepEqual(lines.find((l) => l.category === "Con"), { category: "Con", limit: 1_500_000, source: "set", average: 1_000_000 });
  const auto = lines.filter((l) => l.source === "auto");
  assert.deepEqual(auto.map((l) => l.category), ["Ăn uống", "Mua sắm"]);
  assert.equal(auto.reduce((s, l) => s + l.limit, 0) + 1_500_000, 8_650_000);
  assert.ok(auto[0].limit > auto[1].limit * 2.9 && auto[0].limit < auto[1].limit * 3.1);
  assert.deepEqual(budgetLines(5_000_000, {}, names, {}), []);
});

test("cash flow ahead: lumps land in their month and can turn it negative", () => {
  const flow = cashflow(all, { monthlySaving: 5_000_000 }, ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(flow.map((m) => m.lumps.map((l) => l.name)), [["Học phí quý 4"], [], ["Bảo hiểm nhân thọ"]]);
  assert.equal(flow[1].left, 25_000_000 - 11_350_000 - (20_000_000 - 11_350_000) - 5_000_000);
  assert.equal(flow[0].left, flow[1].left - 9_000_000);
  assert.equal(flow[2].left, flow[1].left - 12_000_000);
  assert.ok(flow[2].left < 0);
});
