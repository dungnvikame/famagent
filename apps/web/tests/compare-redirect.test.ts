import assert from "node:assert/strict";
import test from "node:test";
import { compareToken, resolveCompareItems } from "../src/lib/catalog/compare.ts";
import { decideRedirect, isOfferFresh, priceTimeLabel } from "../src/lib/catalog/offer-status.ts";
import { compareFacts, compareTemplate, composeCompareSummary } from "../src/lib/ai/shopping/compare-summary.ts";
import { passesFactGuard } from "../src/lib/ai/shopping/composer.ts";
import { demoProducts } from "../src/lib/catalog/demo.ts";
import type { chatJson } from "../src/lib/ai/llm/index.ts";

const NOW = Date.parse("2026-09-23T10:00:00Z");
const row = { productSlug: "merries-l", domain: "shopee.vn", affiliateUrl: "https://s.shopee.vn/abc", updatedAt: "2026-09-23T08:00:00Z" };

test("redirect: chỉ HTTPS thuộc domain đã duyệt, giá còn mới", () => {
  const ok = decideRedirect(row, NOW);
  assert.equal(ok.kind, "redirect");
  assert.equal(ok.kind === "redirect" && ok.url.hostname, "s.shopee.vn");
  assert.equal(decideRedirect({ ...row, affiliateUrl: "http://s.shopee.vn/abc" }, NOW).kind, "invalid");
  assert.equal(decideRedirect({ ...row, affiliateUrl: "https://shopee.vn.evil.com/x" }, NOW).kind, "invalid");
  assert.equal(decideRedirect({ ...row, affiliateUrl: "https://evilshopee.vn/x" }, NOW).kind, "invalid", "không nhận domain chỉ trùng hậu tố");
  assert.equal(decideRedirect({ ...row, affiliateUrl: "not a url" }, NOW).kind, "invalid");
  assert.equal(decideRedirect(undefined, NOW).kind, "missing");
  assert.equal(decideRedirect({ ...row, domain: null }, NOW).kind, "missing");
});

test("redirect: giá quá 48h đưa về trang sản phẩm thay vì nơi bán", () => {
  const stale = decideRedirect({ ...row, updatedAt: new Date("2026-09-21T09:00:00Z") }, NOW);
  assert.deepEqual(stale, { kind: "stale", productSlug: "merries-l" });
  assert.equal(isOfferFresh({ updatedAt: "2026-09-21T10:00:00Z" }, NOW), true, "đúng 48h vẫn còn mới");
  assert.equal(isOfferFresh({ updatedAt: "không rõ" }, NOW), false);
  assert.equal(isOfferFresh({ updatedAt: "2020-01-01T00:00:00Z" }, NOW, true), true, "offer minh họa đi tới trang mua thử");
  assert.equal(priceTimeLabel("2026-09-23T01:05:00Z"), "08:05 23/09");
});

test("compare dùng đúng variant + offer đã gợi ý; bỏ token sai; tối đa 3", () => {
  const [a, b, c, d] = demoProducts;
  const tokenOf = (product: typeof a) => compareToken(product.id, product.variants[0].id, product.variants[0].offers[0].id);
  const items = resolveCompareItems(demoProducts, { items: [tokenOf(a), `${b.id}:wrong-variant:x`, tokenOf(c), tokenOf(a), tokenOf(d), tokenOf(b)].join(",") });
  assert.deepEqual(items.map((item) => item.product.id), [a.id, c.id, d.id]);
  assert.equal(items[0].offer?.id, a.variants[0].offers[0].id);
  assert.equal(items[0].unitPrice, a.variants[0].offers[0].price / a.variants[0].quantity);
  const offerMismatch = resolveCompareItems(demoProducts, { items: `${a.id}:${a.variants[0].id}:${b.variants[0].offers[0].id}` });
  assert.equal(offerMismatch[0].offer, null, "offer không thuộc variant thì không hiển thị giá");
  assert.deepEqual(resolveCompareItems(demoProducts, { products: `${a.id},${b.id}` }).map((item) => item.product.id), [a.id, b.id], "link cũ products= vẫn chạy");
});

test("tóm tắt so sánh: template chỉ dùng dữ kiện và qua được fact-guard; AI sai dữ kiện bị thay bằng template", async () => {
  const items = resolveCompareItems(demoProducts, { products: demoProducts.slice(0, 3).map((product) => product.id).join(",") });
  const template = compareTemplate(items);
  assert.match(template, /giá mỗi miếng thấp nhất trong nhóm/);
  assert.match(template, /chưa gồm phí giao/);
  const context = { items: items.map((item) => ({ name: item.product.canonicalName, brand: item.product.brand })), catalog: demoProducts.map((product) => ({ name: product.canonicalName, brand: product.brand })), ordered: false };
  assert.ok(passesFactGuard(template, compareFacts(items), context));
  const fake = (summary: string) => (async () => ({ data: { summary }, provider: "test" })) as unknown as typeof chatJson;
  const bad = await composeCompareSummary(items, true, demoProducts, fake("Sản phẩm này tốt nhất, chỉ 1.000đ/miếng."));
  assert.deepEqual(bad, { text: template, source: "template" });
  const good = await composeCompareSummary(items, true, demoProducts, fake(`Mình thấy ${items[1].product.canonicalName} và ${items[0].product.canonicalName} khác nhau chủ yếu ở giá mỗi miếng; giá chưa gồm phí giao.`));
  assert.equal(good.source, "ai", "không bắt buộc thứ tự khi so sánh");
  assert.deepEqual(await composeCompareSummary(items, false, demoProducts, fake("x")), { text: template, source: "template" });
});
