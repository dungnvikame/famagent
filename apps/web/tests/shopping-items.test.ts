import assert from "node:assert/strict";
import test from "node:test";
import { defaultRate, estimateItems, learnedRate, levelToRemaining, matchItem, runningLow, type ShoppingItem } from "../src/lib/shopping/items.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";

const now = new Date(2026, 8, 24, 9);
const item = (patch: Partial<ShoppingItem> = {}): ShoppingItem => ({ id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, status: "active", ...patch });
const buy = (purchasedOn: string, unitCount: number, patch: Partial<Purchase> = {}): Purchase => ({ id: crypto.randomUUID(), itemId: "i1", productName: "Bỉm Merries L", amount: 345_000, packs: 1, unitCount, purchasedOn, ...patch });

test("mức dùng mặc định theo nhóm", () => {
  assert.equal(defaultRate({ category: "diapers" }, 18), 5);
  assert.equal(defaultRate({ category: "wipes" }), 10);
  assert.equal(defaultRate({ category: "milk" }, 3), 0.14);
  assert.equal(defaultRate({ category: "household", packSize: 1 }), 0.033);
});

test("chưa có lần mua: chưa biết còn bao nhiêu", () => {
  const [estimate] = estimateItems([item()], [], () => 6, now);
  assert.equal(estimate.known, false); assert.equal(estimate.daysLeft, null); assert.deepEqual(runningLow([estimate]), []);
});

test("một lần mua, mặc định 6 miếng/ngày; món tạm ngưng bị bỏ qua", () => {
  const estimates = estimateItems([item(), item({ id: "i2", status: "paused" })], [buy("2026-09-19", 40)], () => 6, now);
  assert.equal(estimates.length, 1);
  assert.equal(estimates[0].remaining, 10); assert.equal(estimates[0].daysLeft, 1); assert.equal(estimates[0].rateSource, "default");
  assert.equal(runningLow(estimates).length, 1); assert.equal(estimates[0].lastPackPrice, 345_000);
});

test("mua đều 64 miếng mỗi 12 ngày → học ~5,33 miếng/ngày, dự báo lệch ≤ 3 ngày", () => {
  const purchases = [buy("2026-08-07", 64), buy("2026-08-19", 64), buy("2026-08-31", 64), buy("2026-09-12", 64)];
  assert.equal(learnedRate(purchases, [], 6), 5.333);
  const [estimate] = estimateItems([item()], purchases, () => 6, now);
  assert.equal(estimate.rateSource, "learned");
  // Real rate 64/12: next rebuy due 2026-09-24; forecast runsOutOn within ±3 days.
  assert.ok(Math.abs(new Date(estimate.runsOutOn!).getTime() - new Date("2026-09-24").getTime()) <= 3 * 86_400_000);
});

test("mua tích trữ sớm không làm sai mức dùng; người dùng đặt tay thắng", () => {
  const purchases = [buy("2026-09-01", 64), buy("2026-09-02", 64), buy("2026-09-14", 64)];
  assert.equal(learnedRate(purchases, [], 6), 5.333);
  const [set] = estimateItems([item({ dailyRate: 4 })], purchases, () => 6, now);
  assert.equal(set.rateSource, "set"); assert.equal(set.dailyRate, 4);
});

test("mốc “còn không?” thay điểm bắt đầu và dạy mức dùng", () => {
  const purchases = [buy("2026-09-01", 64)];
  const checks = [{ id: "c1", itemId: "i1", checkedOn: "2026-09-10", remaining: 30 }, { id: "c2", itemId: "i1", checkedOn: "2026-09-20", remaining: 0 }];
  assert.equal(learnedRate(purchases, checks), 3);
  const [estimate] = estimateItems([item()], [...purchases, buy("2026-09-21", 64)], () => 6, now, checks);
  // From 0 on 20/09, +64 on 21/09, 3/day for 3 days → 55.
  assert.equal(estimate.remaining, 55); assert.equal(estimate.rateSource, "learned");
  assert.equal(levelToRemaining("out", estimate), 0); assert.equal(levelToRemaining("half", estimate), 32);
});

test("khớp tên món không dấu", () => {
  assert.equal(matchItem("merries l", [item()])?.id, "i1");
  assert.equal(matchItem("sữa meiji", [item()]), undefined);
});

test("review 260924-1452: mua cùng ngày với “Hết rồi” được cộng; mốc trước lần mua đầu vẫn tính", () => {
  const out = [{ id: "c", itemId: "i1", checkedOn: "2026-09-24", remaining: 0, createdAt: "2026-09-24T08:00:00Z" }];
  const [same] = estimateItems([item({ dailyRate: 6 })], [buy("2026-09-01", 64), buy("2026-09-24", 64)], () => 6, now, out);
  assert.equal(same.remaining, 64); assert.equal(same.daysLeft, 10);
  const before = [{ id: "c", itemId: "i1", checkedOn: "2026-09-18", remaining: 60 }];
  const [early] = estimateItems([item()], [buy("2026-09-20", 64)], () => 6, now, before);
  // 60 on 18/09 → 48 on 20/09, +64 → 112, −24 by 24/09 → 88.
  assert.equal(early.remaining, 88);
  // Two answers the same day: the later one wins.
  const [corrected] = estimateItems([item()], [buy("2026-09-01", 64)], () => 6, now, [{ id: "a", itemId: "i1", checkedOn: "2026-09-24", remaining: 0, createdAt: "2026-09-24T08:00:00Z" }, { id: "b", itemId: "i1", checkedOn: "2026-09-24", remaining: 40, createdAt: "2026-09-24T09:00:00Z" }]);
  assert.equal(corrected.remaining, 40);
});

test("“Còn ít” không về 0 với món dùng chậm; hai lần mua cùng ngày là một lần bổ sung", () => {
  const slow = item({ category: "household", unit: "can", packSize: 1 });
  const [estimate] = estimateItems([slow], [buy("2026-09-20", 1)], () => 1 / 30, now);
  assert.ok(levelToRemaining("low", estimate) > 0);
  assert.equal(learnedRate([buy("2026-09-01", 64), buy("2026-09-01", 64), buy("2026-09-25", 64)], [], 6), 5.333);
});
