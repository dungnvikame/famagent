import assert from "node:assert/strict";
import test from "node:test";
import type { MoneyTransaction } from "../src/lib/money/types.ts";
import { unlinkedTransactions } from "../src/lib/shopping/reconcile.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";

const tx = (id: string, patch: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id, occurredOn: "2026-09-12", content: "Shopee bỉm merries", category: "Con", kind: "expense", amount: 690_000, forChild: true, source: "manual", ...patch });
const purchase = (id: string, patch: Partial<Purchase> = {}): Purchase => ({ id, itemId: "i1", productName: "Bỉm Merries L", amount: 690_000, packs: 2, unitCount: 128, purchasedOn: "2026-09-12", source: "quick", transactionId: `ledger-${id}`, ...patch });
const ids = (list: MoneyTransaction[]) => list.map((item) => item.id);

test("khoản nhập tay trùng số tiền và ngày (±2) với một lần mua thì không hỏi lại", () => {
  for (const day of ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"]) assert.deepEqual(ids(unlinkedTransactions([tx("a", { occurredOn: day })], [purchase("p")], [])), [], day);
});

test("quá 2 ngày hoặc khác số tiền thì vẫn hỏi", () => {
  assert.deepEqual(ids(unlinkedTransactions([tx("a", { occurredOn: "2026-09-15" })], [purchase("p")], [])), ["a"]);
  assert.deepEqual(ids(unlinkedTransactions([tx("a", { occurredOn: "2026-09-09" })], [purchase("p")], [])), ["a"]);
  assert.deepEqual(ids(unlinkedTransactions([tx("a", { amount: 689_000 })], [purchase("p")], [])), ["a"]);
});

test("một lần mua chỉ giải thích một dòng: hai khoản giống hệt vẫn còn một dòng để hỏi", () => {
  const rows = [tx("a"), tx("b", { occurredOn: "2026-09-13" })];
  assert.deepEqual(ids(unlinkedTransactions(rows, [purchase("p")], [])), ["b"], "dòng gần ngày nhất được coi là đã có");
  assert.deepEqual(ids(unlinkedTransactions(rows, [purchase("p"), purchase("q")], [])), []);
});

test("lần mua đã gắn với dòng sổ nhập tay (source ledger) không che dòng khác", () => {
  const linked = purchase("p", { source: "ledger", transactionId: "a" });
  assert.deepEqual(ids(unlinkedTransactions([tx("a"), tx("b")], [linked], [])), ["b"]);
});

test("hành vi cũ giữ nguyên: đã gắn, đã bỏ qua, không phải nhập tay", () => {
  const list = [tx("a"), tx("c", { source: "purchase" }), tx("d"), tx("e", { occurredOn: "2026-09-20", amount: 5 })];
  assert.deepEqual(ids(unlinkedTransactions(list, [purchase("p", { source: "ledger", transactionId: "d", amount: 1 })], ["a"])), ["e"]);
});
