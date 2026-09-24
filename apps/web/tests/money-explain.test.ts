import assert from "node:assert/strict";
import test from "node:test";
import { answerMoney, detectMoneyQuestion } from "../src/lib/money/answer.ts";
import { explainMonth, planRestOfMonth } from "../src/lib/money/explain.ts";
import type { MonthSummary } from "../src/lib/money/summary.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";
import type { ShoppingItem } from "../src/lib/shopping/items.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";
import { runShoppingTurn } from "../src/lib/ai/shopping/pipeline.ts";

const now = new Date(2026, 8, 20, 9);
const tx = (occurredOn: string, amount: number, category: string): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: category, category, kind: "expense", amount, forChild: category === "Con", source: "manual" });
const month = (expense: number): MonthSummary => ({ month: "2026-09", income: 0, expense, saving: 0, net: 0, plan: 25_000_000, remainingOfPlan: 25_000_000 - expense, childSpend: 0, byCategory: [{ category: "Ăn uống", spent: 3_000_000, limit: 3_500_000, forChild: 0 }], upcoming: [], balances: { cash: 0, savings: 0 }, insights: [], transactionCount: 10 });
const bim: ShoppingItem = { id: "i1", name: "Merries L64", category: "diapers", unit: "miếng", packSize: 64, status: "active" };
const buy = (purchasedOn: string, packs: number): Purchase => ({ id: crypto.randomUUID(), itemId: "i1", productName: "Merries L64", amount: 369_000 * packs, packs, unitCount: 64 * packs, purchasedOn });

test("pace so với bình thường, nhóm tăng nhiều nhất, Con tăng vì lượng chứ không vì giá", () => {
  // Earlier months up to the 20th: 16,7M each (Ăn uống 2,3M, Con 1M); this month 18,2M (Ăn uống 3M, Con 1,62M).
  const earlier = ["2026-06", "2026-07", "2026-08"].flatMap((m) => [tx(`${m}-05`, 13_400_000, "Tiêu dùng"), tx(`${m}-10`, 2_300_000, "Ăn uống"), tx(`${m}-12`, 1_000_000, "Con")]);
  const current = [tx("2026-09-05", 13_580_000, "Tiêu dùng"), tx("2026-09-10", 3_000_000, "Ăn uống"), tx("2026-09-12", 1_620_000, "Con")];
  const purchases = [buy("2026-06-12", 2), buy("2026-07-12", 2), buy("2026-08-12", 2), buy("2026-09-02", 2), buy("2026-09-14", 2)];
  const explain = explainMonth(month(18_200_000), current, earlier, purchases, [bim], now);
  assert.equal(explain.basis, "history"); assert.equal(explain.normalAtDay, 16_700_000); assert.equal(Math.round((explain.paceRatio! - 1) * 100), 9);
  assert.deepEqual(explain.rises.slice(0, 2).map((rise) => [rise.category, rise.diff]), [["Ăn uống", 700_000], ["Con", 620_000]]);
  assert.match(explain.childCause!, /Con tăng chủ yếu vì lượng bỉm dùng nhiều hơn \(\+128 miếng\), không phải vì giá \(giá mỗi miếng gần như không đổi\)/);
  const answer = answerMoney("overview", month(18_200_000), "", explain, now);
  assert.match(answer.text, /^Đã chi 18,2M\. Cao hơn nhịp bình thường khoảng 9%/);
  assert.match(answer.text, /Tăng nhiều nhất: Ăn uống \+700K, Con \+620K/);
  assert.deepEqual(answer.choices[0], "Lập kế hoạch phần còn lại tháng");
});

test("lập kế hoạch phần còn lại tháng", () => {
  assert.equal(detectMoneyQuestion("Lập kế hoạch phần còn lại tháng"), "plan_rest");
  assert.match(planRestOfMonth(month(18_200_000), now), /^Còn 6,8M cho 11 ngày — khoảng 618K\/ngày\. Ngân sách nhóm: Ăn uống còn 500K/);
});

test("Mua lại bỉm cho Gold: phù hợp, lần trước, giá thấp nhất, còn N ngày", async () => {
  const stock = [{ productName: "Merries L64", daysLeft: 4, remaining: 20, lastPurchasedOn: "2026-09-14", itemId: "i1", unit: "miếng", packSize: 64, merchant: "Shopee", lastPackPrice: 369_000, minPackPrice: 349_000 }];
  const result = await runShoppingTurn({ message: "Mua lại bỉm cho Gold", profile: null, previousIntent: null, products: [], allowAi: false, stock });
  assert.match(result.response.text, /Merries L64 hiện còn phù hợp\. Lần trước: 369K ở Shopee\. Giá thấp nhất nhà mình từng trả: 349K\. Dự kiến còn: 4 ngày\./);
  assert.deepEqual(result.response.choices, ["Ghi đã mua lại Merries L64", "So sánh loại khác"]);
});
