import assert from "node:assert/strict";
import test from "node:test";
import { autoDebtId } from "../src/lib/money/debt-link.ts";
import { debtLinkIds, loansByPerson, loanTotals } from "../src/lib/money/loans.ts";
import { debtPayments, sumUntil, withPosition } from "../src/lib/money/position.ts";
import { summarizeMonth } from "../src/lib/money/summary.ts";
import { DEFAULT_CATEGORIES, type MoneyBundle, type MoneyDebt, type MoneyPosition, type MoneyTransaction } from "../src/lib/money/types.ts";
import { validTransaction } from "../src/lib/money/validate.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let n = 0;
const tx = (occurredOn: string, kind: MoneyTransaction["kind"], amount: number, category: string, content: string, extra: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id: id(100 + n++), occurredOn, content, category, kind, amount, forChild: false, source: "manual", ...extra });
const car: MoneyDebt = { id: id(1), name: "Vay mua xe", balance: 380_000_000, recurringId: id(2) };
const sister: MoneyDebt = { id: id(3), name: "Vay em gái", balance: 20_000_000 };
const card: MoneyDebt = { id: id(4), name: "Thẻ VIB", balance: 10_000_000, asOf: "2026-09-10" };

test("every repayment tagged with a debt (or posted by its recurring item) lowers it, once, only after the debt's date", () => {
  const entries = [
    tx("2026-09-20", "expense", 8_000_000, "Tiền trả nợ", "Trả nợ em gái", { debtId: sister.id }),
    tx("2026-09-15", "expense", 8_200_000, "Tiền trả góp", "Trả Vay mua xe", { recurringId: id(2), debtId: car.id }), // tagged AND recurring: one payment
    tx("2026-10-15", "expense", 8_200_000, "Tiền trả góp", "Trả Vay mua xe", { recurringId: id(2) }),
    tx("2026-09-05", "expense", 1_000_000, "Tiền trả nợ", "Trả nợ em gái", { debtId: sister.id }), // before the position date: already in the balance
    tx("2026-09-10", "expense", 500_000, "Tiền trả nợ", "Trả thẻ", { debtId: card.id }), // on the debt's own date: not counted either
    tx("2026-09-12", "expense", 700_000, "Tiền trả nợ", "Trả thẻ", { debtId: card.id }),
    tx("2026-09-13", "income", 999, "Lương", "x", { debtId: sister.id }), // only expenses pay debts
    tx("2026-09-14", "expense", 300_000, "Ăn uống", "phở", { debtId: id(99) }), // unknown debt
  ];
  assert.deepEqual(debtPayments([car, sister, card], "2026-09-08", entries), { [sister.id]: 8_000_000, [car.id]: 16_400_000, [card.id]: 700_000 });
});

test("debt-linked payments leave the Nợ tab's own loan books alone", () => {
  const links = debtLinkIds([car, sister]);
  assert.ok(links.has(car.id) && links.has(id(2)) && links.has(sister.id));
  const entries = [tx("2026-09-01", "income", 20_000_000, "Vay cá nhân", "vay em gái"), tx("2026-09-20", "expense", 8_000_000, "Tiền trả nợ", "Trả nợ em gái", { debtId: sister.id }), tx("2026-09-21", "expense", 2_000_000, "Tiền trả nợ", "Trả nợ Tom")];
  assert.deepEqual(loanTotals(entries, links), { borrowed: 20_000_000, repaid: 2_000_000, lent: 0, collected: 0 });
  assert.deepEqual(loansByPerson(entries, links).owe.map((row) => [row.name, row.left]), [["Em gái", 20_000_000], ["Tom", -2_000_000]]);
});

test("auto-attach: a repayment naming exactly one debt is tagged with it", () => {
  const debts = [car, sister];
  const pay = (category: string, content: string, extra: Partial<MoneyTransaction> = {}) => autoDebtId({ kind: "expense", category, content, ...extra }, debts);
  assert.equal(pay("Tiền trả góp", "Trả Vay mua xe tháng 9"), car.id);
  assert.equal(pay("Tiền trả nợ", "trả nợ em gái"), sister.id);
  assert.equal(pay("Tiền trả nợ quỹ", "VAY MUA XE"), car.id);
  assert.equal(pay("Tiền trả nợ", "Trả nợ Tom"), undefined, "no debt named");
  assert.equal(pay("Ăn uống", "Trả nợ em gái"), undefined, "not a repayment category");
  assert.equal(pay("Tiền trả nợ", "trả nợ em gái", { debtId: car.id }), undefined, "already tagged");
  assert.equal(pay("Tiền trả góp", "Trả Vay mua xe", { recurringId: id(2) }), undefined, "posted by the debt's own recurring item");
  assert.equal(autoDebtId({ kind: "income", category: "Tiền trả nợ", content: "trả nợ em gái" }, debts), undefined, "income is never a repayment");
  assert.equal(autoDebtId({ kind: "expense", category: "Tiền trả nợ", content: "trả nợ em gái" }, [sister, { ...sister, id: id(5) }]), undefined, "two debts match: never guess");
});

test("validTransaction keeps a debt id on expenses only", () => {
  const base = { occurredOn: "2026-09-20", content: "Trả nợ em gái", category: "Tiền trả nợ", amount: 1_000_000 };
  assert.equal(validTransaction({ ...base, kind: "expense", debtId: sister.id })?.debtId, sister.id);
  assert.equal(validTransaction({ ...base, kind: "expense", debtId: "not-a-uuid" })?.debtId, undefined);
  assert.equal(validTransaction({ ...base, kind: "income", debtId: sister.id })?.debtId, undefined);
});

test("ledger rows dated before the position date never change today's balances or debts", () => {
  const position: MoneyPosition = { asOf: "2026-09-24", accounts: [{ id: id(10), name: "VCB", type: "bank", amount: 30_000_000 }, { id: id(11), name: "Sổ", type: "saving", amount: 100_000_000 }], debts: [{ ...sister }] };
  const after = [tx("2026-09-25", "expense", 1_000_000, "Ăn uống", "phở"), tx("2026-09-26", "expense", 2_000_000, "Tiền trả nợ", "Trả nợ em gái", { debtId: sister.id })];
  const before = [tx("2026-01-05", "income", 50_000_000, "Vay cá nhân", "vay em gái"), tx("2026-03-10", "expense", 9_000_000, "Tiền trả nợ", "Trả nợ em gái", { debtId: sister.id }), tx("2026-06-01", "saving", 5_000_000, "Tiết kiệm", "gửi"), tx("2026-08-01", "expense", 700_000, "Tiền cho vay", "Cho Tom vay"), tx("2026-09-23", "expense", 400_000, "Ăn uống", "cơm")];
  const view = (entries: MoneyTransaction[]) => {
    const bundle: MoneyBundle = { month: "2026-09", settings: { openingCash: 0, openingSavings: 0, categories: DEFAULT_CATEGORIES, position }, transactions: entries.filter((e) => e.occurredOn.startsWith("2026-09")), totals: sumUntil(entries, "2026-10-01"), budgets: [], recurring: [], goals: [] };
    const anchored = withPosition(bundle, entries);
    return { balances: summarizeMonth(anchored, new Date(2026, 8, 28)).balances, debtPaid: anchored.debtPaid, debtLog: anchored.debtLog };
  };
  assert.deepEqual(view([...after, ...before]), view(after));
  assert.deepEqual(view(after).balances, { cash: 30_000_000 - 1_000_000 - 2_000_000, savings: 100_000_000 });
  assert.deepEqual(view(after).debtPaid, { [sister.id]: 2_000_000 });
});
