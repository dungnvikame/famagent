import assert from "node:assert/strict";
import test from "node:test";
import type { FamilySnapshot } from "../src/lib/attention/engine.ts";
import { buildWeekly } from "../src/lib/attention/weekly.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";

const now = new Date(2026, 8, 27, 19);
const tx = (occurredOn: string, amount: number, category = "Ăn uống"): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: "x", category, kind: "expense", amount, forChild: false, source: "manual" });
const bim: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, status: "active" };
const wipes: ShoppingItem = { id: "i2", name: "Khăn ướt", category: "wipes", unit: "tờ", packSize: 80, status: "active" };
const purchases = [{ id: "p1", itemId: "i1", productName: "Bỉm", amount: 690_000, packs: 2, unitCount: 128, purchasedOn: "2026-09-25" }, { id: "p2", itemId: "i2", productName: "Khăn", amount: 45_000, packs: 1, unitCount: 80, purchasedOn: "2026-09-20" }];

test("bản tin tuần: tiền so tuần trước, đã mua + đủ bao lâu, tiết kiệm, tuần tới", () => {
  const snapshot: FamilySnapshot = {
    profile: null, conversations: [], history: [tx("2026-09-22", 2_600_000), tx("2026-09-26", 2_600_000), tx("2026-09-16", 4_770_000)],
    month: { month: "2026-09", income: 30_000_000, expense: 20_000_000, saving: 5_000_000, net: 0, plan: undefined, remainingOfPlan: undefined, childSpend: 0, byCategory: [{ category: "Ăn uống", spent: 2_800_000, limit: 3_500_000, forChild: 0 }], upcoming: [], balances: { cash: 0, savings: 0 }, insights: [], transactionCount: 3 },
    goals: [{ id: "g", name: "Quỹ", targetAmount: 1, savedAmount: 0, monthlyPlan: 5_000_000 }],
    estimates: estimateItems([bim, wipes], purchases, (item) => item.category === "diapers" ? 5 : 10, now), plan: [], counts: { transactions: 3, items: 2 },
  };
  const brief = buildWeekly(snapshot, purchases, now);
  assert.deepEqual(brief.money, ["Đã chi 5,2M", "Cao hơn tuần trước 430K"]);
  assert.deepEqual(brief.shopping, ["Đã mua Bỉm Merries L · dự kiến đủ 23 ngày"], "khăn ướt mua 20/9, ngoài 7 ngày");
  assert.deepEqual(brief.goal, ["Tiết kiệm vẫn đúng tiến độ"]);
  assert.deepEqual(brief.nextWeek, ["Có thể cần mua khăn ướt", "Ngân sách Ăn uống còn 700K"]);
  assert.match(brief.headline, /^Tuần này chi 5,2M · có thể cần mua khăn ướt$/);
});
