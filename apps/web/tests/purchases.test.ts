import assert from "node:assert/strict";
import test from "node:test";
import { budgetHint, defaultDailyRate, transactionForPurchase, type Purchase } from "../src/lib/shopping/purchases.ts";

// Stock estimates moved to household items: tests/shopping-items.test.ts.
const buy = (purchasedOn: string, unitCount: number, patch: Partial<Purchase> = {}): Purchase => ({ id: crypto.randomUUID(), itemId: "i1", productId: "merries-l", productName: "Merries L64", brand: "Merries", amount: 350_000, packs: 1, unitCount, purchasedOn, ...patch });

test("mức dùng mặc định theo tuổi", () => { assert.equal(defaultDailyRate(), 6); assert.equal(defaultDailyRate(1), 9); assert.equal(defaultDailyRate(9), 6); assert.equal(defaultDailyRate(18), 5); assert.equal(defaultDailyRate(30), 4); });

test("giao dịch Tiền sinh ra từ purchase", () => {
  const tx = transactionForPurchase(buy("2026-09-24", 128, { packs: 2, merchant: "Shopee", childId: "c1" }), true, "t1");
  assert.deepEqual(tx, { id: "t1", occurredOn: "2026-09-24", content: "Merries L64 ×2", category: "Con", kind: "expense", amount: 350_000, forChild: true, childId: "c1", note: "Mua tại Shopee", source: "purchase" });
  assert.equal(transactionForPurchase(buy("2026-09-24", 64), false, "t2").category, "Mua sắm");
});

test("gợi ý ngân sách khi mua", () => {
  assert.match(budgetHint(350_000, { spent: 300_000, limit: 500_000 }, 5_000_000)!, /vượt phần còn lại của ngân sách Con tháng này \(200\.000đ\)/);
  assert.match(budgetHint(150_000, { spent: 300_000, limit: 500_000 }, 5_000_000)!, /còn 200\.000đ tháng này, sau khoản này còn 50\.000đ/);
  assert.match(budgetHint(350_000, undefined, 1_000_000)!, /kế hoạch chi tháng còn 650\.000đ/);
  assert.match(budgetHint(350_000, undefined, 100_000)!, /vượt phần còn lại của kế hoạch chi tháng \(100\.000đ\)/);
  assert.equal(budgetHint(350_000, undefined, undefined), null);
});
