import assert from "node:assert/strict";
import test from "node:test";
import { readProductMeta, shopOf } from "../src/lib/inbox/link.ts";
import { linkAdvice } from "../src/lib/inbox/link-advice.ts";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";

test("chỉ đọc link từ sàn quen, https", () => {
  assert.equal(shopOf("https://shopee.vn/bim-merries-i.1.2"), "Shopee");
  assert.equal(shopOf("https://vt.tiktok.com/ZS123/"), "TikTok Shop");
  assert.equal(shopOf("http://shopee.vn/x"), null);
  assert.equal(shopOf("https://shopee.vn.evil.com/x"), null);
  assert.equal(shopOf("https://169.254.169.254/latest"), null);
});

test("đọc tên/giá từ thẻ chia sẻ; không có giá thì null", () => {
  const html = `<html><head><meta property="og:title" content="Bỉm quần Merries L64 &amp; quà | Shopee Việt Nam"><meta property="product:price:amount" content="349000"></head></html>`;
  assert.deepEqual(readProductMeta(html), { title: "Bỉm quần Merries L64 & quà", price: 349_000 });
  assert.deepEqual(readProductMeta("<title>Shopee Việt Nam</title>"), { title: "Shopee Việt Nam", price: null });
});

test("so với lịch sử nhà mình, tồn kho và ngân sách", () => {
  const item: ShoppingItem = { id: "i1", name: "Merries L64", category: "diapers", unit: "miếng", packSize: 64, brand: "Merries", status: "active" };
  const purchases = [{ id: "p", itemId: "i1", productName: "Merries L64", amount: 369_000, packs: 1, unitCount: 64, purchasedOn: "2026-09-20" }];
  const estimates = estimateItems([item], purchases, () => 5, new Date(2026, 8, 24, 9));
  const advice = linkAdvice("Bỉm quần Merries L64", 349_000, "Shopee", "2026-09-24", [item], purchases, estimates, { spent: 1_000_000, limit: 2_500_000 }, undefined, 7);
  assert.equal(advice.item?.id, "i1"); assert.equal(advice.changePct, -5);
  assert.match(advice.lines.join(" "), /rẻ hơn 5% so với lần trước/);
  assert.match(advice.lines.join(" "), /còn khoảng 8 ngày sử dụng — chưa cần mua gấp/);
  assert.match(advice.lines.join(" "), /Trong ngân sách Con \+ Mua sắm/);
});

test("tên sản phẩm lấy từ đường dẫn khi trang giấu", async () => {
  const { titleFromUrl } = await import("../src/lib/inbox/link.ts");
  assert.equal(titleFromUrl("https://shopee.vn/Bim-quan-Merries-L44-i.123.456"), "Bim quan Merries L44");
  assert.equal(titleFromUrl("https://vt.tiktok.com/ZS123/"), null);
});
