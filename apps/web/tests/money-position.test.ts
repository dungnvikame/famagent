import assert from "node:assert/strict";
import test from "node:test";
import { allocationFrom, allocationTotal, customFramework, unassigned } from "../src/lib/money/allocation.ts";
import { bucketOf, frameworkById, frameworkProgress, FRAMEWORKS, UNPLACED } from "../src/lib/money/frameworks.ts";
import { debtLeft, debtLeftIn, debtTotals, monthsToPayOff, positionSummary, sumUntil, withPosition } from "../src/lib/money/position.ts";
import { summarizeMonth } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyPosition, type MoneyTransaction } from "../src/lib/money/types.ts";
import { validSettings } from "../src/lib/money/validate.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tx = (n: number, occurredOn: string, kind: MoneyTransaction["kind"], amount: number, extra: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id: id(n), occurredOn, content: `k${n}`, category: kind === "income" ? "Lương" : kind === "saving" ? "Tiết kiệm" : "Ăn uống", kind, amount, forChild: false, source: "manual", ...extra });
const position: MoneyPosition = {
  asOf: "2026-09-24",
  accounts: [{ id: id(1), name: "VCB", type: "bank", amount: 28_500_000 }, { id: id(2), name: "Tiền mặt", type: "cash", amount: 3_000_000 }, { id: id(3), name: "Sổ 12 tháng", type: "saving", amount: 150_000_000 }],
  debts: [{ id: id(4), name: "Vay mua xe", balance: 380_000_000, monthlyPayment: 8_200_000, dueDay: 15, ratePct: 8.5, recurringId: id(5) }, { id: id(6), name: "Vay em gái", balance: 20_000_000 }],
};

test("balances are anchored on the position date, then follow the ledger", () => {
  const entries = [tx(10, "2026-09-05", "income", 30_000_000), tx(11, "2026-09-20", "expense", 2_000_000), tx(12, "2026-09-24", "saving", 5_000_000), tx(13, "2026-09-25", "expense", 1_000_000), tx(14, "2026-10-15", "expense", 8_200_000, { recurringId: id(5), category: "Tiền trả góp", source: "recurring" })];
  const base: MoneyBundle = { month: "2026-09", settings: { openingCash: 999, openingSavings: 999, categories: DEFAULT_CATEGORIES, position }, transactions: entries.filter((e) => e.occurredOn.startsWith("2026-09")), totals: sumUntil(entries, "2026-10-01"), budgets: [], recurring: [], goals: [] };
  const september = summarizeMonth(withPosition(base, entries), new Date(2026, 8, 26));
  // At the start of 24/09 the family had 31.5tr cash + 150tr savings; then 5tr to savings (24/09) and 1tr spent (25/09).
  assert.deepEqual(september.balances, { cash: 25_500_000, savings: 155_000_000 });
  const october = withPosition({ ...base, month: "2026-10", totals: sumUntil(entries, "2026-11-01") }, entries);
  assert.equal(summarizeMonth(october, new Date(2026, 9, 20)).balances.cash, 17_300_000);
  assert.deepEqual(october.debtPaid, { [id(4)]: 8_200_000 });
});

test("position summary: owes, fixed spend, ratios and notes", () => {
  const recurring = [
    { id: id(20), name: "Lương", category: "Lương", kind: "income" as const, amount: 30_000_000, dayOfMonth: 5, active: true },
    { id: id(21), name: "Tiền nhà", category: "Gia đình", kind: "expense" as const, amount: 6_000_000, dayOfMonth: 1, active: true },
    { id: id(5), name: "Trả Vay mua xe", category: "Tiền trả góp", kind: "expense" as const, amount: 8_200_000, dayOfMonth: 15, active: true },
  ];
  const summary = positionSummary({ settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, position }, recurring, debtPaid: { [id(4)]: 8_200_000 } }, { cash: 31_500_000, savings: 150_000_000 }, 0, 0, "2026-09-30");
  assert.equal(summary.owes, 391_800_000);
  assert.equal(summary.fixedExpense, 14_200_000); // debt payment counted once
  assert.equal(summary.fixedIncome, 30_000_000);
  assert.equal(Math.round(summary.debtRatio! * 100), 27);
  assert.equal(summary.emergencyMonths, 10.5);
  assert.deepEqual(summary.notes.map((note) => note.tone), ["ok", "ok"]);
  assert.equal(monthsToPayOff(380_000_000, 8_200_000, 8.5), 57);
  assert.equal(monthsToPayOff(20_000_000, 5_000_000), 4);
  assert.equal(monthsToPayOff(100_000_000, 500_000, 12), undefined);
});

test("custom allocation: from a preset, totals, unassigned, progress by category", () => {
  const categories = [...DEFAULT_CATEGORIES, { name: "Sữa & bỉm", kind: "expense" as const }];
  const split = allocationFrom("50-30-20", categories);
  assert.deepEqual(split.buckets.map((b) => [b.label, b.share]), [["Thiết yếu", 0.5], ["Mong muốn", 0.3], ["Để dành & trả nợ", 0.2]]);
  assert.ok(split.buckets[0].categories.includes("Ăn uống"));
  assert.ok(split.buckets[2].categories.includes("Tiết kiệm"));
  assert.equal(allocationTotal(split), 1);
  // A category the family created has no default part: it is left for the family to place, never dumped into "Mong muốn".
  assert.deepEqual(unassigned(split, categories), ["Sữa & bỉm"]);
  const own = { buckets: [{ key: "a", label: "Thiết yếu", share: 0.6, categories: ["Ăn uống"] }, { key: "b", label: "Cho con", share: 0.2, categories: ["Sữa & bỉm"] }, { key: "c", label: "Để dành", share: 0.2, categories: ["Tiết kiệm"] }] };
  const fw = customFramework(own);
  assert.equal(fw.buckets[2].atLeast, true);
  const progress = frameworkProgress(fw, 30_000_000, [tx(1, "2026-09-02", "expense", 1_000_000), tx(2, "2026-09-03", "expense", 500_000, { category: "Sữa & bỉm" }), tx(3, "2026-09-04", "saving", 5_000_000), tx(4, "2026-09-05", "expense", 700_000, { category: "Giải trí" })]);
  // "Giải trí" is in no part: shown as its own row instead of being dropped.
  assert.deepEqual(progress.map((b) => [b.key, b.target, b.actual]), [["a", 18_000_000, 1_000_000], ["b", 6_000_000, 500_000], ["c", 6_000_000, 5_000_000], [UNPLACED, undefined, 700_000]]);
  assert.equal(progress[3].label, "Chưa xếp phần");
});

test("frameworks with loans as Chi: repayments are essentials or debt, lending is never saving, own categories are unplaced", () => {
  const line = (category: string, kind: MoneyTransaction["kind"] = "expense") => ({ kind, category, amount: 1 });
  for (const repay of ["Tiền trả nợ", "Tiền trả nợ quỹ"]) {
    assert.deepEqual(["jars", "50-30-20", "kakeibo", "baby-steps", "pay-first"].map((id) => bucketOf(id as never, line(repay))), ["nec", "needs", "survival", "debt", "spend"]);
  }
  // Lending: "Cho đi" / wants / unexpected / spend — never "Tự do tài chính", "Để dành" or a saving target.
  assert.deepEqual(["jars", "50-30-20", "kakeibo", "baby-steps", "pay-first"].map((id) => bucketOf(id as never, line("Tiền cho vay"))), ["give", "wants", "unexpected", "spend", "spend"]);
  assert.equal(bucketOf("jars", line("Chi phí đầu tư")), "ffa");
  assert.equal(bucketOf("jars", line("Lương", "income")), null);
  // The family's own category has no default part in frameworks that split spending into kinds; the rest lump it.
  assert.deepEqual(["jars", "50-30-20", "kakeibo"].map((id) => bucketOf(id as never, line("Sữa & bỉm"))), [UNPLACED, UNPLACED, UNPLACED]);
  assert.deepEqual(["baby-steps", "pay-first"].map((id) => bucketOf(id as never, line("Sữa & bỉm"))), ["spend", "spend"]);
  assert.equal(bucketOf("jars", line("Giải trí")), "play");
  const jars = frameworkById("jars")!;
  const progress = frameworkProgress(jars, 30_000_000, [tx(1, "2026-09-02", "expense", 5_000_000, { category: "Tiền cho vay" }), tx(2, "2026-09-03", "expense", 2_000_000, { category: "Tiền trả nợ" }), tx(3, "2026-09-04", "expense", 400_000, { category: "Sữa & bỉm" }), tx(4, "2026-09-05", "income", 20_000_000, { category: "Vay cá nhân" })]);
  assert.deepEqual(progress.filter((row) => row.actual).map((row) => [row.key, row.actual]), [["nec", 2_000_000], ["give", 5_000_000], [UNPLACED, 400_000]]);
  assert.ok(FRAMEWORKS.every((fw) => fw.buckets.every((bucket) => bucket.key !== UNPLACED)));
});

test("settings validation keeps position, allocation and memory; rejects bad shapes", () => {
  const ok = validSettings({ openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, position, allocation: { buckets: [{ key: "a", label: "Tất cả", share: 1, categories: ["Ăn uống"] }] }, categoryMemory: { "do xang": "Đi lại" } });
  assert.equal(ok?.position?.accounts.length, 3);
  assert.equal(ok?.allocation?.buckets[0].share, 1);
  assert.equal(ok?.categoryMemory?.["do xang"], "Đi lại");
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], position: { ...position, asOf: "24/09" } }), null);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], position: { ...position, accounts: [{ id: id(1), name: "X", type: "gold", amount: 1 }] } }), null);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], allocation: { buckets: [{ key: "a", label: "A", share: 1.5, categories: [] }] } }), null);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], position: { ...position, debts: [{ id: id(4), name: "Nợ", balance: 1, dueDay: 40 }] } }), null);
});

test("debt payments become recurring items; removing a debt or its payment drops them", async () => {
  const { syncDebtRecurring, debtCategory } = await import("../src/lib/money/position.ts");
  const active = DEFAULT_CATEGORIES.filter((c) => c.kind === "expense").map((c) => c.name);
  let n = 100; const newId = () => id(n++);
  const car = { id: id(4), name: "Vay mua xe TPBank", balance: 380_000_000, monthlyPayment: 8_200_000, dueDay: 15 };
  const card = { id: id(7), name: "Thẻ tín dụng VIB", balance: 12_000_000, monthlyPayment: 12_000_000, dueDay: 30 };
  const first = syncDebtRecurring([car, card], [], [], active, "2026-09-24", newId);
  assert.deepEqual(first.upserts.map((r) => [r.name, r.category, r.dayOfMonth, r.lastPostedMonth]), [["Trả Vay mua xe TPBank", "Tiền trả góp", 15, "2026-09"], ["Trả Thẻ tín dụng VIB", "Tiền thẻ tín dụng", 30, undefined]]);
  assert.equal(first.debts[0].recurringId, id(100));
  const again = syncDebtRecurring(first.debts, first.debts, first.upserts, active, "2026-09-25", newId);
  assert.deepEqual([again.upserts.length, again.deletes.length], [0, 0]);
  const dropped = syncDebtRecurring([{ ...first.debts[0], monthlyPayment: undefined }], first.debts, first.upserts, active, "2026-09-25", newId);
  assert.deepEqual(dropped.deletes, [id(100), id(101)]);
  assert.equal(debtCategory("Vay em gái", active), "Tiền trả nợ");
});

test("balances typed for the start of 1/1 are opening balances; the ledger adds up from there", async () => {
  const { withPosition, sumUntil } = await import("../src/lib/money/position.ts");
  const { runningPots } = await import("../src/lib/money/history.ts");
  const entries = [tx(1, "2026-01-05", "income", 20_000_000), tx(2, "2026-01-05", "saving", 7_000_000), tx(3, "2026-02-05", "saving", 7_000_000), tx(4, "2026-02-10", "expense", 3_000_000)];
  const pos = { asOf: "2026-01-01", accounts: [{ id: id(1), name: "Momo", type: "ewallet" as const, amount: 26_155_499 }, { id: id(2), name: "Tiết kiệm", type: "saving" as const, amount: 50_000_000 }], debts: [] };
  const bundle = withPosition({ month: "2026-02", settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, position: pos }, transactions: [], totals: sumUntil(entries, "2026-03-01"), budgets: [], recurring: [], goals: [] }, entries);
  assert.deepEqual([bundle.settings.openingCash, bundle.settings.openingSavings], [26_155_499, 50_000_000]);
  const pots = runningPots(entries, bundle.settings.openingCash, bundle.settings.openingSavings);
  assert.deepEqual(pots.get(id(4)), { savings: 64_000_000, lem: 0, account: 93_155_499, cash: 29_155_499 });
});

test("a split part can be a fixed monthly amount instead of a percent", () => {
  const own = { buckets: [{ key: "a", label: "Thiết yếu", share: 0.6, categories: ["Ăn uống"] }, { key: "c", label: "Để dành", share: 0.4, amount: 7_000_000, categories: ["Tiết kiệm"] }] };
  const progress = frameworkProgress(customFramework(own), 30_000_000, [tx(1, "2026-09-04", "saving", 7_000_000)]);
  assert.deepEqual(progress.map((b) => [b.key, b.target]), [["a", 18_000_000], ["c", 7_000_000]]);
  const saved = validSettings({ openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, allocation: own });
  assert.equal(saved?.allocation?.buckets[1].amount, 7_000_000);
  assert.equal(saved?.allocation?.buckets[0].amount, undefined);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], allocation: { buckets: [{ key: "a", label: "A", share: 1, amount: -5, categories: [] }] } }), null);
});

test("a split with a monthly budget keeps the same targets whatever the month's income", () => {
  const own = { base: 40_000_000, buckets: [{ key: "a", label: "Tiêu dùng", share: 0.25, categories: ["Ăn uống"] }, { key: "c", label: "Tiết kiệm", share: 0.75, categories: ["Tiết kiệm"] }] };
  const fw = customFramework(own);
  for (const income of [0, 30_000_000, 51_280_271]) assert.deepEqual(frameworkProgress(fw, income, []).map((b) => b.target), [10_000_000, 30_000_000]);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, allocation: own })?.allocation?.base, 40_000_000);
  assert.equal(validSettings({ openingCash: 0, openingSavings: 0, categories: [], allocation: { ...own, base: 1.5 } }), null);
});

test("reading settings back from the database keeps the split's monthly budget", async () => {
  const { settingsFromRow } = await import("../src/lib/money/store-server.ts");
  const read = settingsFromRow({ opening_cash: 0, opening_savings: 0, categories: DEFAULT_CATEGORIES, allocation: { base: 30_600_000, buckets: [{ key: "a", label: "Tiêu dùng", share: 1, categories: ["Ăn uống"] }] } });
  assert.equal(read.allocation?.base, 30_600_000);
  assert.equal(read.allocation?.buckets[0].share, 1);
});

test("an amount typed for a part is kept exactly, not rebuilt from a rounded percent", () => {
  const own = { base: 30_600_000, buckets: [{ key: "a", label: "Tiêu dùng", share: 23_600_000 / 30_600_000, amount: 23_600_000, categories: ["Ăn uống"] }, { key: "c", label: "Tiết kiệm", share: 7_000_000 / 30_600_000, amount: 7_000_000, categories: ["Tiết kiệm"] }] };
  const saved = validSettings({ openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, allocation: own })!.allocation!;
  assert.deepEqual(frameworkProgress(customFramework(saved), 51_280_271, []).map((b) => b.target), [23_600_000, 7_000_000]);
  assert.equal(Math.round(saved.buckets[1].share * 1000) / 10, 22.9);
});

test("debtLeft without a rate: balance minus payments, whatever the date", () => {
  const debt = { id: "d", name: "Vay em gái", balance: 20_000_000, asOf: "2026-01-01" };
  assert.equal(debtLeft(debt, { d: 5_000_000 }, { today: "2027-06-01" }), 15_000_000);
  assert.equal(debtLeft(debt, { d: 30_000_000 }, { today: "2027-06-01" }), 0);
});

test("debtLeft with a rate: monthly interest for each full month since the date, payments come off in order", () => {
  const debt = { id: "d", name: "Vay", balance: 10_000_000, asOf: "2026-01-15", ratePct: 12 }; // 1% a month
  assert.equal(debtLeft(debt, {}, { today: "2026-02-14" }), 10_000_000, "not a full month yet");
  assert.equal(debtLeft(debt, {}, { today: "2026-02-15" }), 10_100_000);
  assert.equal(debtLeft(debt, {}, { today: "2026-04-20" }), 10_303_010);
  // 2tr on 10/02 comes off after February's interest: 10,1tr − 2tr, then two more months of interest.
  const paid = { d: 2_000_000 };
  assert.equal(debtLeft(debt, paid, { today: "2026-04-20", log: { d: [{ on: "2026-02-10", amount: 2_000_000 }] } }), 8_262_810);
  // The same 2tr paid on 18/04 (after the last full month) only reduces the balance.
  assert.equal(debtLeft(debt, paid, { today: "2026-04-20", log: { d: [{ on: "2026-04-18", amount: 2_000_000 }] } }), 8_303_010);
  // Only totals known: paid as of today.
  assert.equal(debtLeft(debt, paid, { today: "2026-04-20" }), 8_303_010);
  // The date comes from the position when the debt has none; clamped month ends count (31/01 → 28/02).
  assert.equal(debtLeft({ ...debt, asOf: undefined }, {}, { asOf: "2026-01-15", today: "2026-02-15" }), 10_100_000);
  assert.equal(debtLeft({ ...debt, asOf: "2026-01-31" }, {}, { today: "2026-02-28" }), 10_100_000);
});

test("debtLeft and monthsToPayOff share one model: paying the estimated months' worth clears the debt", () => {
  const debt = { id: "d", name: "Vay mua xe", balance: 100_000_000, asOf: "2026-01-15", ratePct: 9 };
  const monthly = 5_000_000;
  const months = monthsToPayOff(debt.balance, monthly, debt.ratePct)!;
  assert.ok(months > 20 && months < 25, String(months));
  const on = (k: number) => new Date(Date.UTC(2026, k, 15)).toISOString().slice(0, 10); // month k after January = 15th
  const log = (count: number) => ({ d: Array.from({ length: count }, (_, i) => ({ on: on(i + 1), amount: monthly })) });
  assert.equal(debtLeft(debt, {}, { today: on(months), log: log(months) }), 0);
  assert.ok(debtLeft(debt, {}, { today: on(months - 1), log: log(months - 1) }) > 0);
  assert.equal(monthsToPayOff(0, monthly, 9), 0);
  assert.equal(monthsToPayOff(100_000_000, 500_000, 12), undefined);
});

test("one definition of total debt: Tình hình, Nợ tab and the header read debtTotals", () => {
  const debts = [{ id: id(4), name: "Vay mua xe", balance: 380_000_000, monthlyPayment: 8_200_000, dueDay: 15, ratePct: 8.5, recurringId: id(5) }, { id: id(6), name: "Vay em gái", balance: 20_000_000, asOf: "2026-09-24" }];
  const bundle = { settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, position: { ...position, debts } }, recurring: [], loans: { borrowed: 5_000_000, repaid: 2_000_000, lent: 4_000_000, collected: 1_000_000 }, debtPaid: { [id(6)]: 3_000_000 }, debtLog: { [id(6)]: [{ on: "2026-09-26", amount: 3_000_000 }] } };
  const totals = debtTotals(bundle, "2026-09-30");
  assert.equal(debtLeftIn(bundle, debts[1], "2026-09-30"), 17_000_000);
  assert.deepEqual(totals, { owed: 3_000_000 + 380_000_000 + 17_000_000, ledgerOwed: 3_000_000, bigOwed: 397_000_000, lent: 3_000_000 });
  assert.equal(positionSummary(bundle, { cash: 0, savings: 0 }, 0, 0, "2026-09-30").owes, totals.owed);
});
