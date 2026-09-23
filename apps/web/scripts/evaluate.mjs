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
  assert.equal(result.intent.schemaVersion, "1", message);
  assert.equal(result.intent.categoryId, "diapers", message);
  assert.equal(result.intent.requiredAttributes.weightKg, weight, message);
  assert.equal(result.intent.constraints.maxTotalPriceVnd, budget, message);
  if (night) assert.equal(result.intent.requiredAttributes.nightUse, true, message);
  assert.ok(result.recommendations.length <= 3, `Quá 3 gợi ý: ${message}`);
  for (const item of result.recommendations) {
    assert.ok(item.product.diaper.minWeightKg <= weight && item.product.diaper.maxWeightKg >= weight, `Sai cân nặng: ${message}`);
    const variant = item.product.variants.find((entry) => entry.id === item.variantId);
    const offer = variant.offers.find((entry) => entry.id === item.offerId);
    assert.ok(offer.price <= budget, `Vượt giá: ${message}`);
    assert.equal(offer.availability, "in_stock");
    assert.equal(item.scoreVersion, "product_score_v1");
  }
  if (result.recommendations.length) withResults++;
  checked++;
}

// Exclusions stay hard filters and a clarification asks at most two questions per turn (spec v1 §7, §9).
const post = async (message) => {
  const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  assert.equal(response.status, 200, `API lỗi với: ${message}`);
  return response.json();
};
const brands = ["Nhãn mẫu A", "Nhãn mẫu B", "Nhãn mẫu C"];
for (const brand of brands) for (const phrasing of ["không dùng", "tránh", "đừng lấy"]) {
  const message = `Tìm bỉm cho bé 10kg, ${phrasing} ${brand}`;
  const result = await post(message);
  assert.ok(result.intent.constraints.excludedBrands?.includes(brand), `Không loại ${brand}: ${message}`);
  assert.ok(result.recommendations.every((item) => item.product.brand !== brand), `Gợi ý thương hiệu bị tránh: ${message}`);
  checked++;
}
for (const message of ["Tìm bỉm ban đêm", "Tìm bỉm cho bé", "mua khăn ướt"]) {
  const result = await post(message);
  assert.ok(((result.question ?? "") + result.text).split("?").length - 1 <= 2, `Hỏi quá 2 câu: ${message}`);
  assert.equal(result.recommendations.length, 0, message);
  checked++;
}

console.log(`Đạt ${checked}/${checked} tình huống: hiểu cân nặng, giá trần, dùng ban đêm, thương hiệu muốn tránh, tối đa 2 câu hỏi/lượt và tuân thủ điều kiện bắt buộc. ${withResults} tình huống có gợi ý trong catalog demo.`);

