import assert from "node:assert/strict";
import test from "node:test";
import { budgetBalance, budgetRows, itemStatus, listedItems, planFigures, scheduleText, stepSaving, suggestedSaving } from "../src/lib/money/plan-model.ts";
import { emptyForm, formFromItem, isDone, monthWindow, previewText, readForm, type RecurringForm } from "../src/lib/money/recurring-form.ts";
import type { DueEntry } from "../src/lib/money/fixed-items.ts";
import { DEFAULT_CATEGORIES, type MoneyRecurring } from "../src/lib/money/types.ts";

const item = (over: Partial<MoneyRecurring> & Pick<MoneyRecurring, "id" | "name">): MoneyRecurring => ({ category: "Tiêu dùng", kind: "expense", amount: 100_000, dayOfMonth: 1, active: true, ...over });
const salary = item({ id: "salary", name: "Lương", kind: "income", category: "Lương", amount: 25_000_000, dayOfMonth: 1, schedule: { kind: "range", to: 5 } });
const rent = item({ id: "rent", name: "Tiền nhà", amount: 6_000_000, dayOfMonth: 1 });
const net = item({ id: "net", name: "Internet", amount: 250_000, dayOfMonth: 26, schedule: { kind: "range", to: 30 }, amountMode: "estimate" });
const school = item({ id: "school", name: "Học phí", amount: 9_000_000, dayOfMonth: 1, schedule: { kind: "quarter", to: 10 } });
const bundle = (recurring: MoneyRecurring[], monthlySaving?: number) => ({ recurring, recurringAmounts: {}, settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, monthlySaving } });

test("schedule text reads like the mock, independent of the viewed month", () => {
  assert.equal(scheduleText(rent), "Hằng tháng · ngày 1");
  assert.equal(scheduleText(net), "Hằng tháng · 26–30");
  assert.equal(scheduleText(item({ id: "x", name: "x", dayOfMonth: 31 })), "Hằng tháng · ngày 31");
  assert.equal(scheduleText(item({ id: "x", name: "x", dayOfMonth: 1, schedule: { kind: "eom" } })), "Hằng tháng · cuối tháng");
  assert.equal(scheduleText(school), "Theo quý · 1–10 của T1/4/7/10");
  assert.equal(scheduleText(item({ id: "x", name: "x", dayOfMonth: 15, schedule: { kind: "year", month: 12 } })), "Hằng năm · tháng 12 · ngày 15");
});

test("saving: 20% suggestion in 500k steps, stepper snaps to the grid and stays within 0..income", () => {
  assert.equal(suggestedSaving(25_000_000), 5_000_000);
  assert.equal(suggestedSaving(12_300_000), 2_500_000);
  assert.equal(suggestedSaving(0), 0);
  assert.equal(stepSaving(5_000_000, 1, 25_000_000), 5_500_000);
  assert.equal(stepSaving(5_000_000, -1, 25_000_000), 4_500_000);
  assert.equal(stepSaving(5_250_000, 1, 25_000_000), 5_500_000);
  assert.equal(stepSaving(5_250_000, -1, 25_000_000), 5_000_000);
  assert.equal(stepSaving(200_000, -1, 25_000_000), 0);
  assert.equal(stepSaving(24_800_000, 1, 24_900_000), 24_900_000);
});

test("plan figures: income − fixed − saving = flexible, plan = income − saving, shares add up", () => {
  const fig = planFigures(bundle([salary, rent, net, school], 5_000_000), "2026-09");
  assert.equal(fig.income, 25_000_000);
  assert.equal(fig.incomeFrom, "Lương");
  assert.equal(fig.fixed, 6_250_000);
  assert.equal(fig.saving, 5_000_000);
  assert.equal(fig.savingStored, true);
  assert.equal(fig.savingPct, 20);
  assert.equal(fig.flex, 13_750_000);
  assert.equal(fig.plan, 20_000_000);
  assert.equal(fig.perDay, 458_000, "per day is shown in whole thousands");
  assert.equal(fig.setAside, 3_000_000);
  assert.ok(Math.abs(fig.bar.fixed + fig.bar.flex + fig.bar.saving - 100) < 1e-9);
});

test("plan figures: nothing stored yet shows the suggestion; too much saving goes negative but the flexible part stays 0", () => {
  const suggested = planFigures(bundle([salary, rent]), "2026-09");
  assert.equal(suggested.savingStored, false);
  assert.equal(suggested.saving, 5_000_000);
  const over = planFigures(bundle([salary, rent], 20_000_000), "2026-09");
  assert.equal(over.flexRaw, -1_000_000);
  assert.equal(over.flex, 0);
  assert.equal(over.plan, 5_000_000);
  const none = planFigures(bundle([rent]), "2026-09");
  assert.equal(none.income, 0);
  assert.deepEqual(planFigures(bundle([]), "2026-09").bar, { fixed: 0, flex: 0, saving: 0 });
});

test("item status this month: paid with date and amount, skipped, waiting states, done flag, paused", () => {
  const due = (recurringId: string, state: DueEntry["state"], period = "2026-09"): DueEntry => ({ recurringId, name: "", kind: "expense", category: "", period, from: `${period}-26`, to: `${period}-30`, label: "", daysToStart: 0, state, amount: 0, estimated: false });
  const periods = [{ recurringId: "rent", period: "2026-09", status: "paid" as const, paidOn: "2026-09-01", amount: 6_000_000 }, { recurringId: "salary", period: "2026-09", status: "skipped" as const }];
  assert.deepEqual(itemStatus(rent, "2026-09", periods, [], "2026-09-29"), { tone: "paid", label: "Đã trả 01/09 · 6tr" });
  assert.deepEqual(itemStatus({ ...salary }, "2026-09", periods, [], "2026-09-29"), { tone: "skipped", label: "Bỏ qua kỳ này" });
  assert.equal(itemStatus(item({ id: "in", name: "Thu", kind: "income" }), "2026-09", [{ recurringId: "in", period: "2026-09", status: "paid", paidOn: "2026-09-05", amount: 1_000_000 }], [], "2026-09-29").label, "Đã nhận 05/09 · 1tr");
  assert.equal(itemStatus(net, "2026-09", [], [due("net", "due")], "2026-09-29").label, "Tới hạn");
  assert.equal(itemStatus(net, "2026-09", [], [due("net", "overdue")], "2026-09-29").label, "Quá hạn");
  assert.equal(itemStatus(net, "2026-09", [], [due("net", "soon")], "2026-09-29").label, "Sắp tới");
  assert.equal(itemStatus(net, "2026-09", [], [due("net", "overdue", "2026-08")], "2026-09-29").label, "Chưa tới");
  assert.equal(itemStatus({ ...net, lastPostedMonth: "2026-09" }, "2026-09", [], [], "2026-09-29").label, "Đã xong");
  assert.equal(itemStatus(school, "2026-09", [], [], "2026-09-29").label, "Chưa tới");
  assert.equal(itemStatus(net, "2026-07", [], [], "2026-09-29").label, "Chưa ghi nhận");
  assert.deepEqual(itemStatus({ ...net, active: false }, "2026-09", periods, [due("net", "due")], "2026-09-29"), { tone: "paused", label: "Tạm dừng" });
});

test("list order: income first, running before paused, savings left out", () => {
  const paused = { ...salary, id: "old", name: "Thưởng", active: false };
  const saving = item({ id: "sv", name: "Quỹ", kind: "saving" });
  assert.deepEqual(listedItems([net, paused, rent, saving, salary]).map((entry) => entry.id), ["salary", "rent", "net", "old"]);
});

test("budget rows merge the plan with what was spent; balance says what is not shared out yet", () => {
  const summary = {
    budgetPlan: [{ category: "Ăn uống", limit: 4_200_000, source: "auto" as const, average: 4_000_000 }, { category: "Con", limit: 1_500_000, source: "set" as const, average: 1_000_000 }],
    byCategory: [{ category: "Ăn uống", spent: 1_280_000, forChild: 0 }],
  };
  const rows = budgetRows(summary, [{ id: "b1", category: "Con", month: "2026-09", limitAmount: 1_500_000 }, { id: "b2", category: "Ăn uống", month: "2026-08", limitAmount: 1 }], "2026-09");
  assert.deepEqual(rows.map((row) => [row.category, row.spent, row.source, row.budgetId]), [["Ăn uống", 1_280_000, "auto", undefined], ["Con", 0, "set", "b1"]]);
  assert.deepEqual(budgetBalance(rows, 6_000_000), { total: 5_700_000, free: 300_000 });
  assert.equal(budgetBalance(rows, 5_000_000).free, -700_000);
});

const form = (over: Partial<RecurringForm>): RecurringForm => ({ ...emptyForm("Tiền điện"), name: "Tiền điện", day: "5", amount: "600k", ...over });
const ctx = { id: "new-id", month: "2026-09", today: "2026-09-29" };

test("form → item: every schedule builds the matching MoneyRecurring", () => {
  const monthly = readForm(form({}), ctx);
  assert.deepEqual("item" in monthly && monthly.item, { id: "new-id", name: "Tiền điện", kind: "expense", category: "Tiền điện", amount: 600_000, dayOfMonth: 5, active: true, schedule: { kind: "month" }, amountMode: "fixed", lastPostedMonth: "2026-09" });
  const range = readForm(form({ schedule: "range", day: "5", to: "12", mode: "estimate" }), { ...ctx, today: "2026-09-01" });
  assert.deepEqual("item" in range && [range.item.schedule, range.item.amountMode, range.item.lastPostedMonth], [{ kind: "range", to: 12 }, "estimate", undefined]);
  const eom = readForm(form({ schedule: "eom", day: "" }), ctx);
  assert.deepEqual("item" in eom && [eom.item.schedule, eom.item.dayOfMonth], [{ kind: "eom" }, 31]);
  const quarter = readForm(form({ schedule: "quarter", day: "1", to: "10" }), ctx);
  assert.deepEqual("item" in quarter && quarter.item.schedule, { kind: "quarter", to: 10 });
  const quarterNoTo = readForm(form({ schedule: "quarter", day: "1" }), ctx);
  assert.deepEqual("item" in quarterNoTo && quarterNoTo.item.schedule, { kind: "quarter" });
  const year = readForm(form({ schedule: "year", yearMonth: "12", day: "15", kind: "income" }), ctx);
  assert.deepEqual("item" in year && [year.item.schedule, year.item.kind, year.item.dayOfMonth], [{ kind: "year", month: 12 }, "income", 15]);
});

test("form validation: same limits as the API, with a sentence telling what to fix", () => {
  const error = (over: Partial<RecurringForm>) => { const read = readForm(form(over), ctx); return "error" in read ? read.error : null; };
  assert.match(error({ name: "  " }) ?? "", /Nhập tên/);
  assert.match(error({ amount: "" }) ?? "", /Số tiền/);
  assert.match(error({ amount: "abc" }) ?? "", /Số tiền/);
  assert.match(error({ day: "0" }) ?? "", /1 đến 31/);
  assert.match(error({ day: "32" }) ?? "", /1 đến 31/);
  assert.match(error({ day: "x" }) ?? "", /1 đến 31/);
  assert.match(error({ schedule: "range", day: "5", to: "" }) ?? "", /đến ngày/i);
  assert.match(error({ schedule: "range", day: "12", to: "5" }) ?? "", /từ 12 đến 31/);
  assert.match(error({ schedule: "quarter", day: "5", to: "3" }) ?? "", /từ 5 đến 31/);
  assert.match(error({ schedule: "year", yearMonth: "13" }) ?? "", /1 đến 12/);
  assert.equal(error({}), null);
});

test("editing keeps the item's active flag and settled month; the done box only matters for new items", () => {
  const existing = item({ id: "e1", name: "Điện", active: false, lastPostedMonth: "2026-08", schedule: { kind: "range", to: 12 } });
  const read = readForm({ ...formFromItem(existing), amount: "700k" }, { ...ctx, id: existing.id, existing });
  assert.deepEqual("item" in read && [read.item.id, read.item.active, read.item.lastPostedMonth, read.item.amount], ["e1", false, "2026-08", 700_000]);
  assert.deepEqual(formFromItem(existing), { schedule: "range", name: "Điện", kind: "expense", category: "Tiêu dùng", day: "1", to: "12", yearMonth: "12", mode: "fixed", amount: "100000" });
});

test("this month done by default once the window has passed; the family's choice wins; none when it does not come this month", () => {
  assert.equal(monthWindow(form({ day: "5" }), "2026-09", "2026-09-29"), "passed");
  assert.equal(monthWindow(form({ day: "30" }), "2026-09", "2026-09-29"), "open");
  assert.equal(monthWindow(form({ schedule: "range", day: "26", to: "30" }), "2026-09", "2026-09-29"), "open");
  assert.equal(monthWindow(form({ schedule: "range", day: "5", to: "12" }), "2026-09", "2026-09-29"), "passed");
  assert.equal(monthWindow(form({ schedule: "quarter" }), "2026-09", "2026-09-29"), "none");
  assert.equal(monthWindow(form({ schedule: "year", yearMonth: "9", day: "10" }), "2026-09", "2026-09-29"), "passed");
  assert.equal(isDone(form({ day: "5" }), "2026-09", "2026-09-29"), true);
  assert.equal(isDone(form({ day: "5", done: false }), "2026-09", "2026-09-29"), false);
  assert.equal(isDone(form({ day: "30" }), "2026-09", "2026-09-29"), false);
  assert.equal(isDone(form({ day: "30", done: true }), "2026-09", "2026-09-29"), true);
  assert.equal(isDone(form({ schedule: "quarter", done: true }), "2026-09", "2026-09-29"), false);
  const read = readForm(form({ day: "5", done: false }), ctx);
  assert.equal("item" in read && read.item.lastPostedMonth, undefined);
});

test("preview sentence follows the form", () => {
  const monthly = previewText(form({ name: "Tiền điện", mode: "estimate", schedule: "range", day: "5", to: "12" }));
  assert.equal(monthly.name, "Tiền điện");
  assert.match(monthly.rest, /^hằng tháng, nhắc từ ngày 5 đến 12\. Không tự ghi: tới kỳ app hỏi “Đã trả\?”\. Số tiền ước lượng ~600\.000đ lần đầu, sau đó tự lấy trung bình 3 kỳ gần nhất\.$/);
  assert.match(previewText(form({ name: "", schedule: "eom", kind: "income", mode: "fixed", amount: "" })).rest, /^vào cuối mỗi tháng\. Không tự ghi: tới kỳ app hỏi “Đã nhận\?”\. Số tiền cố định …\.$/);
  assert.equal(previewText(form({ name: "" })).name, "Khoản này");
  assert.match(previewText(form({ schedule: "quarter", day: "1", to: "10" })).rest, /^mỗi quý \(tháng 1, 4, 7, 10\), nhắc từ ngày 1 đến 10\./);
  assert.match(previewText(form({ schedule: "year", yearMonth: "12", day: "15" })).rest, /^mỗi năm vào tháng 12, nhắc từ ngày 15\./);
});
