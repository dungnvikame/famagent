import assert from "node:assert/strict";
import test from "node:test";
import { demoProducts } from "../src/lib/catalog/demo.ts";
import { filterProducts, lowestMatchingOffer, pricePerPiece } from "../src/lib/catalog/filter.ts";

test("lọc cùng lúc cân nặng, size và giá trần", () => {
  const result = filterProducts(demoProducts, { weightKg: 10, size: "L", maxPrice: 350000 });
  assert.deepEqual(result.map((item) => item.id), ["demo-4", "demo-3"]);
  for (const product of result) {
    const match = lowestMatchingOffer(product, { size: "L", maxPrice: 350000 });
    assert.ok(match);
    assert.ok(match.offer.price <= 350000);
    assert.equal(match.variant.size, "L");
  }
});

test("không trả sản phẩm sai cân nặng", () => {
  const result = filterProducts(demoProducts, { weightKg: 15 });
  assert.deepEqual(result.map((item) => item.id), ["demo-5"]);
});

test("giá mỗi miếng lấy từ đúng gói", () => {
  const match = lowestMatchingOffer(demoProducts[1], {});
  assert.ok(match);
  assert.equal(pricePerPiece(match.offer, match.variant), 379000 / 56);
});

