import assert from "node:assert/strict";
import test from "node:test";
import { monthlyHistory } from "../src/lib/money/history.ts";
import { categoryRows, cumulativeSpend, dailyCash, monthInsights, pulseOf, topExpenses, versusLastMonth } from "../src/lib/money/month-report.ts";
import { summarizeMonth, sumByKind } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyTransaction } from "../src/lib/money/types.ts";

let n = 0;
const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category = "Ăn uống"): MoneyTransaction => ({ id: `t${n++}`, occurredOn, content: category, category, kind, amount, forChild: false, source: "manual" });
const august = [tx("2026-08-05", "expense", 3_000_000), tx("2026-07-05", "expense", 3_000_000), tx("2026-06-05", "expense", 3_000_000), tx("2026-08-10", "income", 30_000_000, "Lương"), tx("2026-08-12", "expense", 20_000_000, "Gia đình")];
const september = [tx("2026-09-02", "expense", 1_000_000), tx("2026-09-05", "income", 30_000_000, "Lương"), tx("2026-09-06", "saving", 5_000_000, "Tiết kiệm"), tx("2026-09-12", "expense", 3_500_000), tx("2026-09-15", "expense", 4_700_000, "Con"), tx("2026-09-20", "expense", 6_000_000, "Gia đình")];
const all = [...august, ...september];
const bundle: MoneyBundle = { month: "2026-09", settings: { openingCash: 2_000_000, openingSavings: 0, monthlyPlan: 20_000_000, categories: DEFAULT_CATEGORIES }, transactions: september, totals: sumByKind(all), budgets: [{ id: "b1", category: "Con", month: "2026-09", limitAmount: 4_000_000 }, { id: "b2", category: "Gia đình", month: "2026-09", limitAmount: 8_000_000 }], recurring: [], goals: [], history: monthlyHistory(all, "2026-09", 12) };
const now = new Date(2026, 8, 25, 10);
const summary = summarizeMonth(bundle, now);

test("pulse: pace against the plan, plan to date, today marker", () => {
  const pulse = pulseOf(summary, now);
  assert.equal(pulse.spent, 15_200_000);
  assert.equal(pulse.planToDate, Math.round(20_000_000 * 25 / 30));
  assert.equal(pulse.daysLeft, 5);
  assert.equal(pulse.status, "ok");
  assert.equal(pulseOf({ ...summary, plan: undefined }, now).status, "none");
  assert.equal(pulseOf(summary, new Date(2026, 9, 3)).status, "done");
});

test("category rows: spent, budget, 3-month average and change", () => {
  const rows = categoryRows(september, bundle.budgets, bundle.history, "2026-09");
  assert.deepEqual(rows.map((r) => [r.name, r.spent, r.budget, r.average, r.change]), [
    ["Gia đình", 6_000_000, 8_000_000, 6_666_667, -10],
    ["Con", 4_700_000, 4_000_000, undefined, undefined],
    ["Ăn uống", 4_500_000, undefined, 3_000_000, 50],
  ]);
});

test("insights: overspend first, then jumps vs usual, then good news; at most three", () => {
  const rows = categoryRows(september, bundle.budgets, bundle.history, "2026-09");
  const insights = monthInsights(summary, rows, now);
  assert.deepEqual(insights.map((i) => [i.tone, i.text]), [
    ["warn", "Con vượt ngân sách 700.000đ"],
    ["warn", "Ăn uống cao hơn trung bình 3 tháng 50%"],
    ["ok", "Để dành 17% thu nhập tháng này"],
  ]);
  assert.deepEqual(insights[0].action, { label: "Xem 1 khoản", kind: "ledger", category: "Con" });
});

test("versus last month, cumulative spend, daily cash, top expenses", () => {
  assert.deepEqual(versusLastMonth(bundle.history, "2026-09")!.map((d) => [d.label, d.value, d.diff]), [["Thu", 30_000_000, 0], ["Chi", 15_200_000, -7_800_000], ["Để dành", 5_000_000, 5_000_000]]);
  const cumulative = cumulativeSpend(september, "2026-09", 25);
  assert.equal(cumulative[0], 0); assert.equal(cumulative[1], 1_000_000); assert.equal(cumulative[24], 15_200_000);
  const cash = dailyCash(september, "2026-09", 2_000_000, 25);
  assert.equal(cash[1], 1_000_000); assert.equal(cash[5], 26_000_000); assert.equal(cash[24], 11_800_000);
  assert.deepEqual(topExpenses(september, "2026-09", 2).map((t) => t.amount), [6_000_000, 4_700_000]);
});
