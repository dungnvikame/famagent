import assert from "node:assert/strict";
import test from "node:test";
import { checkCatalog, parseCsv, REQUIRED, staleOffers } from "../scripts/lib/catalog-csv.mjs";

const NOW = new Date("2026-09-23T10:00:00Z");
const header = [...REQUIRED, "night_use_score", "attribute_source", "attribute_verified_at", "availability"];
const base: Record<string, string> = {
  product_id: "p1", slug: "merries-l", name: "Merries quần L", brand: "Merries", category: "diapers", image_url: "https://img.example.vn/p1.jpg",
  variant_id: "v1", variant: "L · 64 miếng", size: "L", quantity: "64", merchant_id: "m1", merchant: "Shop A", merchant_domain: "shopee.vn",
  offer_id: "o1", source: "shopee", price: "399000", affiliate_url: "https://s.shopee.vn/abc", min_weight_kg: "9", max_weight_kg: "14", diaper_type: "pants",
  price_verified_at: "2026-09-23T08:00:00Z", night_use_score: "", attribute_source: "", attribute_verified_at: "", availability: "",
};
const csv = (rows: Array<Record<string, string>>) => [header.join(","), ...rows.map((row) => header.map((key) => row[key] ?? "").join(","))].join("\n");
const problems = (rows: Array<Record<string, string>>) => checkCatalog(parseCsv(csv(rows)), NOW).map((item: { line: number; message: string }) => `${item.line}: ${item.message}`);

test("CSV hợp lệ không có lỗi", () => {
  assert.deepEqual(problems([base, { ...base, offer_id: "o2", merchant_id: "m2", merchant: "Shop B", merchant_domain: "tiktok.com", source: "tiktok", affiliate_url: "https://vt.tiktok.com/x" }]), []);
});

test("báo mọi lỗi theo dòng thay vì dừng ở lỗi đầu", () => {
  const found = problems([{ ...base, price: "-1", size: "XXXL", affiliate_url: "http://s.shopee.vn/abc" }, { ...base, offer_id: "o9", merchant_domain: "lazada.vn" }]);
  assert.ok(found.some((line) => line.startsWith("2: price")));
  assert.ok(found.some((line) => line.startsWith("2: size")));
  assert.ok(found.some((line) => line.startsWith("2: affiliate_url phải là URL HTTPS")));
  assert.ok(found.some((line) => line.startsWith("3: URL offer không thuộc merchant_domain")));
});

test("điểm chất lượng bắt buộc có nguồn; giá phải có thời điểm xác minh hợp lệ", () => {
  assert.ok(problems([{ ...base, night_use_score: "4" }]).some((line) => line.includes("thiếu attribute_source")));
  assert.ok(problems([{ ...base, night_use_score: "4", attribute_source: "Nhãn bao bì" }]).some((line) => line.includes("thiếu attribute_verified_at")));
  assert.deepEqual(problems([{ ...base, night_use_score: "4", attribute_source: "Nhãn bao bì chụp 20/09/2026", attribute_verified_at: "2026-09-20T09:00:00+07:00" }]), []);
  assert.ok(problems([{ ...base, attribute_source: "x".repeat(301) }]).some((line) => line.includes("dài quá 300")));
  assert.ok(problems([{ ...base, price_verified_at: "hôm qua" }]).some((line) => line.includes("price_verified_at không phải")));
  assert.ok(problems([{ ...base, price_verified_at: "2026-09-23 08:00" }]).some((line) => line.includes("price_verified_at không phải")), "không có múi giờ bị từ chối");
  assert.ok(problems([{ ...base, price_verified_at: "2026-09-30T00:00:00Z" }]).some((line) => line.includes("ở tương lai")));
});

test("merchant_domain phải là hostname đầy đủ; giới hạn số theo schema", () => {
  for (const domain of ["vn", "https://shopee.vn", "shopee.vn/path", "shopee.vn:443"]) assert.ok(problems([{ ...base, merchant_domain: domain }]).some((line) => line.includes("hostname đầy đủ")), domain);
  assert.ok(problems([{ ...base, price: "3000000000" }]).some((line) => line.startsWith("2: price phải là số nguyên")));
  assert.ok(problems([{ ...base, max_weight_kg: "1000" }]).some((line) => line.includes("max_weight_kg phải nhỏ hơn 1000")));
});

test("offer có giá quá hạn được đánh dấu để nhập với availability unknown", () => {
  const rows = parseCsv(csv([base, { ...base, offer_id: "o2", merchant_id: "m2", merchant: "Shop B", merchant_domain: "tiktok.com", source: "tiktok", affiliate_url: "https://vt.tiktok.com/x", price_verified_at: "2026-09-20T08:00:00Z" }]));
  assert.deepEqual(staleOffers(rows, NOW).map((row: { offer_id: string }) => row.offer_id), ["o2"]);
  assert.deepEqual(staleOffers(rows, NOW, 100), []);
});

test("kiểm tra chéo: offer trùng, product/variant không nhất quán, trùng size + số miếng", () => {
  const found = problems([
    base,
    { ...base, brand: "Moony" },
    { ...base, offer_id: "o3", size: "M" },
    { ...base, offer_id: "o4", variant_id: "v2" },
    { ...base, offer_id: "o5", merchant_domain: "evil.example", affiliate_url: "https://evil.example/y" },
    { ...base, offer_id: "o6", product_id: "p2", variant_id: "v6" },
  ]);
  assert.ok(found.some((line) => line.startsWith("6: merchant_domain của merchant m1")));
  assert.ok(found.some((line) => line.startsWith("7: slug merries-l đã dùng cho product p1")));
  assert.ok(found.some((line) => line.startsWith("3: offer_id o1 trùng")));
  assert.ok(found.some((line) => line.startsWith("3: brand của product p1")));
  assert.ok(found.some((line) => line.startsWith("4: size của variant v1")));
  assert.ok(found.some((line) => line.startsWith("5: product p1 đã có variant v1")));
});

test("header: thiếu cột bắt buộc hoặc cột lạ bị từ chối ngay", () => {
  assert.throws(() => parseCsv("product_id,slug\np1,x"), /Thiếu cột bắt buộc/);
  assert.throws(() => parseCsv(`${header.join(",")},commission\n`), /Cột không được hỗ trợ: commission/);
  assert.throws(() => parseCsv(`${header.join(",")},price\n`), /Cột bị lặp: price/);
});
