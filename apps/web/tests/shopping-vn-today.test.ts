import assert from "node:assert/strict";
import test from "node:test";
import { estimateItems, vnToday, type ShoppingItem } from "../src/lib/shopping/items.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";

test("vnToday theo giờ Việt Nam, không theo UTC", () => {
  assert.equal(vnToday(new Date("2026-09-28T20:30:00Z")), "2026-09-29", "3h30 sáng 29/9 ở VN");
  assert.equal(vnToday(new Date("2026-09-29T16:59:59Z")), "2026-09-29");
  assert.equal(vnToday(new Date("2026-09-29T17:00:00Z")), "2026-09-30");
});

test("ước lượng tồn kho lúc 0–7h sáng (server UTC) tính đúng ngày Việt Nam", () => {
  const item: ShoppingItem = { id: "i1", name: "Bỉm", category: "diapers", unit: "miếng", packSize: 60, dailyRate: 6, status: "active" };
  const purchase: Purchase = { id: "p1", itemId: "i1", productName: "Bỉm", amount: 300_000, packs: 1, unitCount: 60, purchasedOn: "2026-09-20" };
  // 3:30 on 29/9 in Vietnam is still 28/9 in UTC: 9 days since the purchase, not 8.
  const [estimate] = estimateItems([item], [purchase], () => 6, new Date("2026-09-28T20:30:00Z"));
  assert.equal(estimate.remaining, 6);
  assert.equal(estimate.daysLeft, 1);
});
