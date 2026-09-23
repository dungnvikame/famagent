// Chạy trên ứng dụng đang mở: EVAL_BASE_URL=http://localhost:3001 pnpm eval
import assert from "node:assert/strict";

const base = process.env.EVAL_BASE_URL || "http://localhost:3000";
const weights = [6, 8, 10, 12, 14];
const budgets = [300000, 350000, 400000, 450000, 500000];
let checked = 0; let withResults = 0;

for (const weight of weights) for (const budget of budgets) for (const night of [false, true]) {
  const message = `Tìm bỉm ${night ? "ban đêm " : ""}cho bé ${weight}kg dưới ${budget}đ`;
  const response = await fetch(`${base}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, profile: { id: "evaluation", children: [], pricePreference: "balanced", aiConsent: false, updatedAt: new Date().toISOString() } }),
  });
  assert.equal(response.status, 200, `API lỗi với: ${message}`);
  const result = await response.json();
  assert.equal(result.intent.category, "diapers", message);
  assert.equal(result.intent.weightKg, weight, message);
  assert.equal(result.intent.maxPrice, budget, message);
  if (night) assert.equal(result.intent.nightUse, true, message);
  for (const item of result.recommendations) {
    assert.ok(item.product.diaper.minWeightKg <= weight && item.product.diaper.maxWeightKg >= weight, `Sai cân nặng: ${message}`);
    const variant = item.product.variants.find((entry) => entry.id === item.variantId);
    const offer = variant.offers.find((entry) => entry.id === item.offerId);
    assert.ok(offer.price <= budget, `Vượt giá: ${message}`);
    assert.equal(offer.availability, "in_stock");
  }
  if (result.recommendations.length) withResults++;
  checked++;
}

console.log(`Đạt ${checked}/50 tình huống: hiểu cân nặng, giá trần, dùng ban đêm và tuân thủ điều kiện bắt buộc. ${withResults} tình huống có gợi ý trong catalog demo.`);

