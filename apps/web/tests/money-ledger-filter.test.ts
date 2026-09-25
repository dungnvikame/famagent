import assert from "node:assert/strict";
import test from "node:test";
import { applyFilter, isFiltering, monthRange, parseFilterQuery, presetOf, presetRange } from "../src/lib/money/ledger-filter.ts";
import { monthlyHistory, categoryAverages, runningBalances } from "../src/lib/money/history.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";

const today = "2026-09-25"; // a Friday
const cats = ["Ăn uống", "Con", "Tiền trả nợ", "Tiền trả nợ quỹ", "Tiết kiệm", "Lương", "Mua sắm"];

test("presets: weeks run Monday–Sunday; months and rolling ranges", () => {
  assert.deepEqual(presetRange("week", today), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(presetRange("lastWeek", today), { from: "2026-09-14", to: "2026-09-20" });
  assert.deepEqual(presetRange("7d", today), { from: "2026-09-19", to: "2026-09-25" });
  assert.deepEqual(presetRange("lastMonth", today), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(presetRange("month", today), monthRange("2026-09"));
  assert.equal(presetOf("2026-09-01", "2026-09-30", today), "month");
});

test("a typed sentence becomes filter fields", () => {
  assert.deepEqual(parseFilterQuery("ăn uống tuần này trên 200k", cats, today), { patch: { from: "2026-09-21", to: "2026-09-27", min: 200_000, categories: ["Ăn uống"] }, text: "" });
  assert.deepEqual(parseFilterQuery("từ 1/9 đến 15/9 dưới 1tr cho con", cats, today).patch, { from: "2026-09-01", to: "2026-09-15", max: 1_000_000, forChild: true });
  assert.deepEqual(parseFilterQuery("tiền trả nợ quỹ", cats, today).patch, { categories: ["Tiền trả nợ quỹ"] });
  assert.deepEqual(parseFilterQuery("thu tháng trước", cats, today).patch, { from: "2026-08-01", to: "2026-08-31", kinds: ["income"] });
  assert.deepEqual(parseFilterQuery("grab khoản lớn", cats, today), { patch: { min: 1_000_000 }, text: "grab" });
  assert.deepEqual(parseFilterQuery("hằng tháng", cats, today).patch, { monthly: true });
});

const tx = (id: string, occurredOn: string, kind: MoneyTransaction["kind"], amount: number, extra: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id, occurredOn, content: `khoản ${id}`, category: "Ăn uống", kind, amount, forChild: false, source: "manual", ...extra });
const entries = [tx("5", "2026-09-24", "expense", 385_000, { content: "Đi chợ cuối tuần" }), tx("4", "2026-09-22", "expense", 120_000), tx("3", "2026-09-15", "income", 20_000_000, { category: "Lương" }), tx("2", "2026-09-10", "expense", 900_000, { category: "Con", forChild: true, recurringId: "r1" }), tx("1", "2026-09-01", "saving", 5_000_000, { category: "Tiết kiệm" })];

test("applyFilter combines every field", () => {
  const base = { kinds: [], categories: [], ...monthRange("2026-09"), text: "" };
  assert.equal(applyFilter(entries, base).length, 5);
  assert.deepEqual(applyFilter(entries, { ...base, categories: ["Ăn uống"], min: 200_000 }).map((e) => e.id), ["5"]);
  assert.deepEqual(applyFilter(entries, { ...base, kinds: ["income", "saving"] }).map((e) => e.id), ["3", "1"]);
  assert.deepEqual(applyFilter(entries, { ...base, forChild: true }).map((e) => e.id), ["2"]);
  assert.deepEqual(applyFilter(entries, { ...base, monthly: true }, new Set(["r1"])).map((e) => e.id), ["2"]);
  assert.deepEqual(applyFilter(entries, { ...base, text: "cho cuoi" }).map((e) => e.id), ["5"]);
  assert.deepEqual(applyFilter(entries, { ...base, from: "2026-09-20", to: "2026-09-27" }).map((e) => e.id), ["5", "4"]);
  assert.equal(isFiltering(base, "2026-09"), false);
  assert.equal(isFiltering({ ...base, text: "x" }, "2026-09"), true);
});

test("running balance, history and category averages", () => {
  const balances = runningBalances(entries, 1_000_000);
  assert.equal(balances.get("1"), -4_000_000);
  assert.equal(balances.get("3"), 15_100_000);
  assert.equal(balances.get("5"), 14_595_000);
  const history = monthlyHistory([...entries, tx("a", "2026-08-12", "expense", 600_000), tx("b", "2026-07-03", "expense", 300_000)], "2026-09", 3);
  assert.deepEqual(history.map((row) => [row.month, row.expense]), [["2026-07", 300_000], ["2026-08", 600_000], ["2026-09", 1_405_000]]);
  assert.deepEqual(categoryAverages(history, "2026-09"), { "Ăn uống": 450_000 });
});

test("pots: savings fund, spent beyond cash (tiêu lẹm) and account total after each entry", async () => {
  const { runningPots, potsOf } = await import("../src/lib/money/history.ts");
  const list = [tx("s5", "2026-09-22", "expense", 4_500_000), tx("s4", "2026-09-18", "expense", 9_200_000), tx("s3", "2026-09-15", "expense", 850_000), tx("s2", "2026-09-05", "saving", 7_000_000), tx("s1", "2026-09-05", "income", 25_000_000)];
  const pots = runningPots(list, -12_738_470, 112_000_000);
  assert.deepEqual(pots.get("s1"), { savings: 112_000_000, lem: 0, account: 124_261_530, cash: 12_261_530 });
  assert.deepEqual(pots.get("s2"), { savings: 119_000_000, lem: 0, account: 124_261_530, cash: 5_261_530 });
  assert.equal(pots.get("s4")!.lem, 4_788_470);
  assert.equal(pots.get("s4")!.account, 114_211_530);
  assert.deepEqual(pots.get("s5"), { savings: 119_000_000, lem: 9_288_470, account: 109_711_530, cash: -9_288_470 });
  assert.deepEqual(potsOf(3_000_000, 10_000_000), { savings: 10_000_000, lem: 0, account: 13_000_000, cash: 3_000_000 });
});
