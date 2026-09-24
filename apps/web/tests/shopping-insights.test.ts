import assert from "node:assert/strict";
import test from "node:test";
import { paydays, saleDays, waitForSale } from "../src/lib/shopping/calendar.ts";
import { benchmarkNote, cadenceDays, merchantShare, monthlySpend, unitPriceTrend } from "../src/lib/shopping/insights.ts";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";
import type { Purchase } from "../src/lib/shopping/purchases.ts";
import { upcomingStages } from "../src/lib/shopping/stages.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const now = new Date(2026, 8, 24, 9);
const merries: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, status: "active" };
const omo: ShoppingItem = { id: "i2", name: "Omo", category: "household", unit: "can", packSize: 1, status: "active" };
const buy = (itemId: string, purchasedOn: string, amount: number, unitCount: number, merchant = "Shopee"): Purchase => ({ id: crypto.randomUUID(), itemId, productName: itemId, amount, packs: 1, unitCount, purchasedOn, merchant });
const purchases = [buy("i1", "2026-07-10", 320_000, 64), buy("i1", "2026-07-22", 330_000, 64), buy("i1", "2026-08-03", 330_000, 64, "Con Cưng"), buy("i1", "2026-09-12", 360_000, 64), buy("i2", "2026-09-02", 185_000, 1, "Bách Hóa Xanh")];

test("chi 6 tháng theo nhóm khớp tổng lần mua", () => {
  const lines = monthlySpend(purchases, [merries, omo], 6, now);
  assert.deepEqual(lines.map((line) => line.month), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.equal(lines.reduce((sum, line) => sum + line.total, 0), purchases.reduce((sum, purchase) => sum + purchase.amount, 0));
  assert.deepEqual(lines[5].byCategory, { diapers: 360_000, household: 185_000 });
});

test("nơi mua, giá mỗi miếng, nhịp mua", () => {
  const share = merchantShare(purchases, "2026-01-01");
  assert.equal(share[0].merchant, "Shopee"); assert.equal(share.reduce((sum, line) => sum + line.share, 0), 100);
  // Last 360k/64 vs average of the three before (≈ 330k/64) → ≈ +10%.
  assert.equal(unitPriceTrend(merries, purchases), 10);
  assert.equal(unitPriceTrend(omo, purchases), null);
  assert.equal(cadenceDays(merries, purchases), 12);
});

test("so với mức thường gặp theo tuổi (chỉ khi đã học được mức dùng)", () => {
  const [estimate] = estimateItems([merries], purchases.filter((purchase) => purchase.itemId === "i1").slice(0, 3), () => 5, now);
  assert.match(benchmarkNote(estimate, 14, "bé Gold")!, /bé Gold dùng 5,3 miếng\/ngày — khớp mức thường gặp/);
  assert.equal(benchmarkNote({ ...estimate, rateSource: "default" }, 14), null);
});

test("giai đoạn: sắp đổi size bỉm, ăn dặm, bỏ qua mục đã có", () => {
  const profile = (weightKg: number, ageMonths: number): FamilyProfile => ({ children: [{ id: "c1", name: "Gold", weightKg, ageMonths, diaperSize: "L" }] } as FamilyProfile);
  assert.equal(upcomingStages(profile(10.6, 14), [], now).some((stage) => stage.key.startsWith("stage:size-")), false);
  const heavy = upcomingStages(profile(13.4, 14), [], now);
  assert.match(heavy.find((stage) => stage.key === "stage:size-XL:c1")!.detail, /Đừng tích trữ size L/);
  const baby = upcomingStages(profile(7, 5), [], now);
  assert.ok(baby.some((stage) => stage.key === "stage:solids:c1"));
  const hidden = upcomingStages(profile(7, 5), [{ id: "e", month: "2026-09", stageKey: "stage:solids:c1", name: "Ăn dặm", packs: 1, reason: "stage", status: "bought" }], now);
  assert.equal(hidden.some((stage) => stage.key === "stage:solids:c1"), false);
});

test("mốc lương, ngày sale; chỉ gợi chờ sale khi còn đủ hàng và trong ngân sách", () => {
  assert.deepEqual(saleDays("2026-09-24", "2026-10-24").map((sale) => sale.on), ["2026-10-10"]);
  assert.ok(saleDays("2026-11-01", "2026-11-30").some((sale) => sale.label === "Black Friday" && sale.on === "2026-11-27"));
  assert.deepEqual(paydays([{ id: "r", name: "Lương", category: "Lương", kind: "income", amount: 20_000_000, dayOfMonth: 31, active: true }], "2026-09-24", "2026-10-24").map((day) => day.on), ["2026-09-30"]);
  const [estimate] = estimateItems([merries], [buy("i1", "2026-09-20", 345_000, 128)], () => 5, now);
  const sales = saleDays("2026-09-24", "2026-10-24");
  assert.equal(waitForSale(estimate, sales, "2026-09-24", false)?.label, "sale 10.10");
  assert.equal(waitForSale(estimate, sales, "2026-09-24", true), null);
});
