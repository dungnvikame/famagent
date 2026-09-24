import assert from "node:assert/strict";
import test from "node:test";
import { budgetHint, defaultDailyRate, estimateStock, runningLow, transactionForPurchase, type Purchase } from "../src/lib/shopping/purchases.ts";

const now = new Date(2026, 8, 24, 9);
const buy = (purchasedOn: string, unitCount: number, patch: Partial<Purchase> = {}): Purchase => ({ id: crypto.randomUUID(), productId: "merries-l", productName: "Merries L64", brand: "Merries", amount: 350_000, packs: 1, unitCount, purchasedOn, ...patch });

test("mức dùng mặc định theo tuổi", () => { assert.equal(defaultDailyRate(), 6); assert.equal(defaultDailyRate(1), 9); assert.equal(defaultDailyRate(9), 6); assert.equal(defaultDailyRate(18), 5); assert.equal(defaultDailyRate(30), 4); });

test("một lần mua: 64 miếng ngày 12/09, 6 miếng/ngày → 24/09 còn ~0? không: 64 − 12×6 = −8 → hết", () => {
  const [item] = estimateStock([buy("2026-09-12", 64)], () => 6, now);
  assert.equal(item.remaining, 0); assert.equal(item.daysLeft, 0); assert.equal(item.rateSource, "default");
});

test("hai lần mua cộng dồn; mức dùng do người dùng đặt được ưu tiên; sắp hết trong 7 ngày", () => {
  const items = estimateStock([buy("2026-09-12", 64), buy("2026-09-21", 64, { dailyRate: 5 })], () => 6, now);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.dailyRate, 5); assert.equal(item.rateSource, "set"); assert.equal(item.purchaseCount, 2);
  assert.equal(item.remaining, 128 - 12 * 5); assert.equal(item.daysLeft, Math.floor(68 / 5)); assert.equal(item.runsOutOn, "2026-10-07");
  assert.deepEqual(runningLow(items), []);
  const low = estimateStock([buy("2026-09-20", 30, { productId: "omo", productName: "Omo 3.8L" })], () => 1, now);
  assert.equal(low[0].daysLeft, 26);
  const soon = estimateStock([buy("2026-09-19", 40)], () => 6, now);
  assert.equal(soon[0].remaining, 10); assert.equal(soon[0].daysLeft, 1); assert.equal(runningLow(soon).length, 1);
});

test("sắp xếp theo ngày còn lại; giao dịch Tiền sinh ra từ purchase", () => {
  const items = estimateStock([buy("2026-09-01", 200, { productId: "a", productName: "A" }), buy("2026-09-23", 64, { productId: "b", productName: "B" })], () => 6, now);
  // a: 200 − 23×6 = 62 → 10 ngày; b: 64 − 1×6 = 58 → 9 ngày → b sắp hết trước.
  assert.deepEqual(items.map((item) => [item.productId, item.daysLeft]), [["b", 9], ["a", 10]]);
  const tx = transactionForPurchase(buy("2026-09-24", 128, { packs: 2, merchant: "Shopee", childId: "c1" }), true, "t1");
  assert.deepEqual(tx, { id: "t1", occurredOn: "2026-09-24", content: "Merries L64 ×2", category: "Con", kind: "expense", amount: 350_000, forChild: true, childId: "c1", note: "Mua tại Shopee", source: "purchase" });
  assert.equal(transactionForPurchase(buy("2026-09-24", 64), false, "t2").category, "Mua sắm");
});

test("gợi ý ngân sách khi mua", () => {
  assert.match(budgetHint(350_000, { spent: 300_000, limit: 500_000 }, 5_000_000)!, /vượt phần còn lại của ngân sách Con tháng này \(200K\)/);
  assert.match(budgetHint(150_000, { spent: 300_000, limit: 500_000 }, 5_000_000)!, /còn 200K tháng này, sau khoản này còn 50K/);
  assert.match(budgetHint(350_000, undefined, 1_000_000)!, /kế hoạch chi tháng còn 650K/);
  assert.match(budgetHint(350_000, undefined, 100_000)!, /vượt phần còn lại của kế hoạch chi tháng \(100K\)/);
  assert.equal(budgetHint(350_000, undefined, undefined), null);
});
