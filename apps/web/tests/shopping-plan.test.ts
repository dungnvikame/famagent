import assert from "node:assert/strict";
import test from "node:test";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";
import { entryFor, mergePlan, planTotal, proposePlan, shiftMonth } from "../src/lib/shopping/plan.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";
import { packsFor, suggestItems, unlinkedTransactions } from "../src/lib/shopping/reconcile.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";

const now = new Date(2026, 8, 24, 9);
const merries: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, status: "active" };
const omo: ShoppingItem = { id: "i2", name: "Nước giặt Omo", category: "household", unit: "can", packSize: 1, status: "active" };
const buy = (itemId: string, purchasedOn: string, unitCount: number, patch: Partial<Purchase> = {}): Purchase => ({ id: crypto.randomUUID(), itemId, productName: itemId, amount: 345_000, packs: 1, unitCount, purchasedOn, ...patch });

test("đề xuất kế hoạch: món hết trước cuối tháng + 7 ngày, đủ gói để phủ tới đó", () => {
  const estimates = estimateItems([merries, omo], [buy("i1", "2026-09-19", 40), buy("i2", "2026-09-20", 1, { amount: 185_000 })], (item) => item.category === "diapers" ? 6 : 1 / 30, now);
  const lines = proposePlan(estimates, "2026-09", "2026-09-24");
  assert.equal(lines.length, 1);
  // 10 miếng left → out 25/09; cover to 07/10 = 12 days × 6 = 72 → 2 packs of 64.
  assert.equal(lines[0].itemId, "i1"); assert.equal(lines[0].packs, 2); assert.equal(lines[0].estAmount, 690_000); assert.equal(lines[0].dueOn, "2026-09-25");
  assert.equal(planTotal(lines), 690_000);
});

test("mục của gia đình ghi đè đề xuất; bỏ qua không tính vào tổng; dời tháng sau", () => {
  const proposals = proposePlan(estimateItems([merries], [buy("i1", "2026-09-19", 40)], () => 6, now), "2026-09", "2026-09-24");
  const skipped = entryFor(proposals[0], "2026-09", { status: "skipped" }, "e1");
  const manual = { id: "e2", month: "2026-09", name: "Ghế ăn dặm", packs: 1, estAmount: 500_000, reason: "manual" as const, status: "planned" as const };
  const merged = mergePlan(proposals, [skipped, manual, { ...manual, id: "e3", month: "2026-10" }], "2026-09");
  assert.deepEqual(merged.map((line) => [line.name, line.status]), [["Ghế ăn dặm", "planned"], ["Bỉm Merries L", "skipped"]]);
  assert.equal(planTotal(merged), 500_000);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("đối soát: chỉ khoản Chi nhập tay nhóm Con/Mua sắm chưa gắn và chưa bỏ qua", () => {
  const tx = (id: string, patch: Partial<MoneyTransaction> = {}): MoneyTransaction => ({ id, occurredOn: "2026-09-12", content: "Shopee bỉm merries", category: "Con", kind: "expense", amount: 690_000, forChild: true, source: "manual", ...patch });
  const list = [tx("a"), tx("b", { category: "Ăn uống" }), tx("c", { source: "purchase" }), tx("d"), tx("e"), tx("f", { occurredOn: "2026-09-20", category: "Mua sắm" })];
  const unlinked = unlinkedTransactions(list, [buy("i1", "2026-09-01", 64, { transactionId: "d" })], ["e"]);
  assert.deepEqual(unlinked.map((item) => item.id), ["f", "a"]);
  assert.deepEqual(suggestItems(tx("a"), [omo, merries], [buy("i2", "2026-09-01", 1), buy("i2", "2026-09-10", 1)]).map((item) => item.id), ["i1", "i2"]);
});

test("gắn khoản sổ: số gói suy từ giá gói lần trước", () => {
  const merriesItem: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, status: "active" };
  assert.equal(packsFor(690_000, merriesItem, [buy("i1", "2026-09-01", 64)]), 2);
  assert.equal(packsFor(690_000, merriesItem, []), 1);
});
