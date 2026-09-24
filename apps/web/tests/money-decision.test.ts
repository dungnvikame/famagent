import assert from "node:assert/strict";
import test from "node:test";
import { decide, detectBigPurchase } from "../src/lib/money/decision.ts";
import type { MonthSummary } from "../src/lib/money/summary.ts";

const summary: MonthSummary = { month: "2026-09", income: 30_000_000, expense: 15_500_000, saving: 0, net: 0, plan: 20_000_000, remainingOfPlan: 4_500_000, expectedExpense: 19_500_000, childSpend: 0, byCategory: [], upcoming: [], balances: { cash: 0, savings: 0 }, insights: [], transactionCount: 30 };

test("nhận ra ý định mua lớn, không nhầm đồ dùng hằng ngày", () => {
  assert.deepEqual(detectBigPurchase("Tôi muốn mua robot hút bụi 8 triệu"), { what: "robot hút bụi", amount: 8_000_000 });
  assert.deepEqual(detectBigPurchase("có nên mua xe đẩy tầm 3tr5 không"), { what: "xe đẩy", amount: 3_500_000 });
  assert.equal(detectBigPurchase("muốn mua bỉm dưới 400k"), null);
  assert.equal(detectBigPurchase("muốn mua sữa Meiji 1tr2"), null);
  assert.equal(detectBigPurchase("đã mua robot hút bụi 8 triệu"), null);
});

test("8 triệu: vượt kế hoạch, thiếu mục tiêu tiết kiệm ~3,5M, mức giá giữ được mục tiêu", () => {
  const decision = decide({ what: "robot hút bụi", amount: 8_000_000 }, summary, [{ id: "g", name: "Quỹ", targetAmount: 100_000_000, savedAmount: 0, monthlyPlan: 6_000_000 }]);
  assert.equal(decision.shortfall, 3_500_000); assert.equal(decision.keepsGoalUnder, 4_500_000);
  assert.match(decision.text, /chưa đánh giá được model/);
  assert.match(decision.text, /khoản 8M sẽ vượt kế hoạch 3,5M/);
  assert.match(decision.text, /thấp hơn mục tiêu \(6M\/tháng\) khoảng 3,5M/);
});
