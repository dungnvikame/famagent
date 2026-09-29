import assert from "node:assert/strict";
import test from "node:test";
import { eligibleVariants, filterProducts, variantWeightRange } from "../src/lib/catalog/filter.ts";
import type { Product, ProductVariant } from "../src/lib/catalog/types.ts";
import { hardFilter, recommend } from "../src/lib/ranking/recommend.ts";
import { mergeIntent } from "../src/lib/ai/shopping/context-merger.ts";
import { extractShoppingRules } from "../src/lib/ai/shopping/extract.ts";

const NOW = Date.parse("2026-09-23T10:00:00Z");
const variant = (size: string, min: number | undefined, max: number | undefined, price: number, quantity = 60): ProductVariant => ({
  id: `v-${size}`, name: `${size} · ${quantity}`, size, quantity, quantityUnit: "piece", minWeightKg: min, maxWeightKg: max,
  offers: [{ id: `o-${size}`, merchantId: "m", merchantName: "Shop", source: "direct", price, currency: "VND", availability: "in_stock", updatedAt: "2026-09-23T08:00:00Z" }],
});
// M is the cheapest per piece on purpose: the old code picked it for a 13 kg child.
const line: Product = {
  id: "line", slug: "line", canonicalName: "Dòng M–XL", brand: "Hãng", category: "diapers",
  diaper: { minWeightKg: 6, maxWeightKg: 17, type: "pants" },
  variants: [variant("M", 6, 11, 200_000), variant("L", 9, 14, 280_000), variant("XL", 12, 17, 300_000)],
};
const intentFor = (message: string) => mergeIntent(extractShoppingRules(message), null, null);
const pickedSize = (weightKg: number, sizeLabel?: string) => {
  const intent = intentFor("mua bỉm");
  intent.requiredAttributes = { ...intent.requiredAttributes, weightKg, sizeLabel };
  const { recommendations } = recommend([line], intent, NOW);
  return recommendations[0]?.product.variants.find((item) => item.id === recommendations[0].variantId)?.size;
};

test("13 kg: L hoặc XL, không bao giờ size M", () => {
  const size = pickedSize(13);
  assert.ok(size === "L" || size === "XL", `got ${size}`);
  assert.equal(size, "L", "L rẻ hơn XL mỗi miếng");
});

test("8 kg chọn size M; 16 kg chỉ XL", () => {
  assert.equal(pickedSize(8), "M");
  assert.equal(pickedSize(16), "XL");
});

test("cân nặng thắng size: 13 kg + size M cũ ra L, kèm ghi chú", () => {
  assert.equal(pickedSize(13, "M"), "L");
  const intent = intentFor("mua bỉm");
  intent.requiredAttributes = { ...intent.requiredAttributes, weightKg: 13, sizeLabel: "M" };
  const [rec] = recommend([line], intent, NOW).recommendations;
  assert.ok(rec.tradeoffs.some((text) => text.includes("size M")));
  assert.ok(rec.reasons[0].includes("9–14"), "lý do dùng dải của variant");
});

test("size trùng cân nặng thì giữ size đó", () => {
  assert.equal(pickedSize(13, "XL"), "XL");
});

test("không variant nào vừa cân nặng thì loại vì weight", () => {
  const intent = intentFor("mua bỉm");
  intent.requiredAttributes = { ...intent.requiredAttributes, weightKg: 25 };
  const { candidates, rejected } = hardFilter([line], intent);
  assert.equal(candidates.length, 0);
  assert.deepEqual(rejected[0].reasons, ["weight"]);
});

test("không có cân nặng thì size lọc như cũ", () => {
  assert.equal(pickedSize(8, undefined), "M");
  const intent = intentFor("mua bỉm");
  intent.requiredAttributes = { ...intent.requiredAttributes, weightKg: undefined, sizeLabel: "L" };
  assert.equal(recommend([line], intent, NOW).recommendations[0].variantId, "v-L");
});

test("variant chưa có dải riêng dùng dải của sản phẩm", () => {
  const legacy: Product = { ...line, variants: line.variants.map((item) => ({ ...item, minWeightKg: undefined, maxWeightKg: undefined })) };
  assert.deepEqual(variantWeightRange(legacy, legacy.variants[0]), { min: 6, max: 17 });
  const half: ProductVariant = { ...line.variants[0], maxWeightKg: undefined };
  assert.deepEqual(variantWeightRange(line, half), { min: 6, max: 17 }, "thiếu một đầu thì bỏ qua");
  assert.equal(filterProducts([legacy], { weightKg: 13 }).length, 1);
});

test("sản phẩm không bán size đó thì vẫn bị loại, không đổi sang size khác", () => {
  const onlyM: Product = { ...line, id: "only-m", variants: [line.variants[0]] };
  assert.deepEqual(eligibleVariants(onlyM, { weightKg: 10, size: "L" }), { variants: [], sizeDropped: false });
  const intent = intentFor("mua bỉm");
  intent.requiredAttributes = { ...intent.requiredAttributes, weightKg: 10, sizeLabel: "L" };
  assert.deepEqual(hardFilter([onlyM], intent).rejected[0].reasons, ["size"]);
});

test("filterProducts (catalog) cũng theo variant", () => {
  assert.deepEqual(eligibleVariants(line, { weightKg: 13 }).variants.map((item) => item.size), ["L", "XL"]);
  assert.deepEqual(eligibleVariants(line, { weightKg: 13, size: "m" }), { variants: [line.variants[1], line.variants[2]], sizeDropped: true });
  assert.equal(filterProducts([line], { weightKg: 13, size: "M" })[0]?.variants.length, 3);
  assert.equal(filterProducts([line], { weightKg: 30 }).length, 0);
});
