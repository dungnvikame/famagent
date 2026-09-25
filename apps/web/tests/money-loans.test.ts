import assert from "node:assert/strict";
import test from "node:test";
import { debtOverview, isLoanEntry, loansByPerson, loanTotals, personOf } from "../src/lib/money/loans.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";

let n = 0;
const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category: string, content: string, extra: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id: `l${n++}`, occurredOn, content, category, kind, amount, forChild: false, source: "manual", ...extra });

test("the person in a loan line", () => {
  assert.equal(personOf("Tom vay bet"), "Tom");
  assert.equal(personOf("Tom trả tiền bet"), "Tom");
  assert.equal(personOf("A Báu trả"), "A Báu");
  assert.equal(personOf("cho chị Hà mượn"), "Hà");
  assert.equal(personOf("vay mẹ"), "Mẹ");
  assert.equal(personOf("trả nợ anh Nam"), "Anh Nam");
  assert.equal(personOf("vay em gái"), "Em gái");
  assert.equal(personOf("Bác Thủy trả"), "Bác Thủy");
  assert.equal(personOf("Trả góp xe"), undefined);
});

test("loan totals, overview and people", () => {
  const entries = [
    tx("2025-12-12", "expense", 5_000_000, "Tiền cho vay", "Tom vay"), tx("2026-01-01", "expense", 5_000_000, "Tiền cho vay", "Tom vay bet"),
    tx("2026-01-10", "income", 5_000_000, "Tiền trả nợ nhận về", "Tom trả tiền bet"), tx("2026-01-10", "income", 1_000_000, "Tiền trả nợ nhận về", "Tom trả nợ"),
    tx("2026-01-05", "expense", 4_000_000, "Tiền cho vay", "A Báu vay"), tx("2026-01-10", "income", 3_000_000, "Tiền trả nợ nhận về", "A Báu trả"),
    tx("2026-02-01", "income", 20_000_000, "Vay cá nhân", "vay em gái"), tx("2026-09-03", "expense", 8_000_000, "Tiền trả nợ", "trả nợ em gái"),
    tx("2026-09-15", "expense", 8_200_000, "Tiền trả nợ", "Trả Vay mua xe", { recurringId: "r-car" }),
    tx("2026-09-20", "expense", 300_000, "Ăn uống", "phở"),
  ];
  assert.equal(isLoanEntry(entries[0]), true); assert.equal(isLoanEntry(entries[9]), false);
  const totals = loanTotals(entries, new Set(["r-car"]));
  assert.deepEqual(totals, { borrowed: 20_000_000, repaid: 8_000_000, lent: 14_000_000, collected: 9_000_000 });
  const overview = debtOverview(totals, [{ id: "d1", name: "Vay mua xe", balance: 380_000_000 }], (debt) => debt.balance);
  assert.deepEqual(overview, { owed: 392_000_000, ledgerOwed: 12_000_000, bigOwed: 380_000_000, lent: 5_000_000 });
  const people = loansByPerson(entries, new Set(["r-car"]));
  assert.deepEqual(people.lent.map((p) => [p.name, p.given, p.received, p.left]), [["Tom", 10_000_000, 6_000_000, 4_000_000], ["A Báu", 4_000_000, 3_000_000, 1_000_000]]);
  assert.deepEqual(loansByPerson(entries, new Set(["r-car"])).owe.map((p) => [p.name, p.left]), [["Em gái", 12_000_000]]);
  assert.equal(people.lent[0].entries[0].occurredOn, "2026-01-10");
});

test("Thu/Chi leave loans out; cash change keeps them", async () => {
  const { summarizeMonth, sumByKind } = await import("../src/lib/money/summary.ts");
  const { DEFAULT_CATEGORIES } = await import("../src/lib/money/types.ts");
  const list = [tx("2026-09-05", "income", 25_000_000, "Lương", "Lương"), tx("2026-09-06", "income", 6_000_000, "Tiền trả nợ nhận về", "Mẹ trả"), tx("2026-09-07", "expense", 5_000_000, "Tiền cho vay", "Tom vay"), tx("2026-09-08", "expense", 400_000, "Ăn uống", "phở")];
  const summary = summarizeMonth({ month: "2026-09", settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES }, transactions: list, totals: sumByKind(list), budgets: [], recurring: [], goals: [] }, new Date(2026, 8, 25));
  assert.equal(summary.income, 25_000_000);
  assert.equal(summary.expense, 400_000);
  assert.equal(summary.cashChange, 25_600_000);
  assert.deepEqual(summary.byCategory.map((line) => line.category), ["Ăn uống"]);
});
