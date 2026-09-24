import assert from "node:assert/strict";
import test from "node:test";
import { looksLikePurchaseLog, parsePurchase } from "../src/lib/shopping/capture.ts";
import type { ShoppingItem } from "../src/lib/shopping/items.ts";

const today = "2026-09-24";
const merries: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, brand: "Merries", status: "active" };

test("nhận ra câu ghi lần mua, bỏ qua câu hỏi mua", () => {
  assert.equal(looksLikePurchaseLog("vừa mua 2 bịch Merries L 64 miếng 690k ở Shopee"), true);
  assert.equal(looksLikePurchaseLog("hôm qua mua khăn ướt Bobby 135k"), true);
  // Without a past-tense word the chat treats it as a request; the Shopping quick-entry bar still logs it.
  assert.equal(looksLikePurchaseLog("mua sữa Meiji 1tr1 ở Con Cưng"), false);
  assert.equal(looksLikePurchaseLog("mua bỉm dưới 400k"), false);
  assert.equal(looksLikePurchaseLog("tôi cần mua bỉm ban đêm cho Gold, dưới 400k"), false);
  assert.equal(looksLikePurchaseLog("nên mua bỉm gì 300k?"), false);
  assert.equal(looksLikePurchaseLog("mua lại Merries L 345k"), false);
  assert.equal(looksLikePurchaseLog("vừa mua bỉm"), false);
  // Review 260924-1452: questions and plans that mention a price and a shop are not purchase logs.
  for (const question of ["mua bỉm 300k cho em bé 8kg", "mua bỉm Merries ở Shopee 300k được không", "mình định mua bỉm Merries 690k ở Shopee", "mua Huggies 350k ở Tiki có rẻ không", "mua kem dưỡng da 200k", "mua bỉm Merries 690k ở Shopee"]) assert.equal(looksLikePurchaseLog(question), false, question);
  for (const log of ["đã mua 2 can nước giặt 380k", "vừa mua lại 2 bịch bỉm 600k", "mua 2 bịch bỉm 690k ở Shopee rồi", "sáng nay mua rau ở chợ 120k"]) assert.equal(looksLikePurchaseLog(log), true, log);
});

test("“cho” không bị hiểu là chợ; “ở chợ” thì đúng", () => {
  assert.equal(parsePurchase("vừa mua bỉm cho em bé 300k", [], today).merchant, undefined);
  assert.equal(parsePurchase("sáng nay mua rau ở chợ 120k", [], today).merchant, "Chợ");
});

test("tách số gói, số miếng, số tiền, nơi mua, ngày", () => {
  const draft = parsePurchase("vừa mua 2 bịch Merries L 64 miếng 690k ở Shopee", [], today);
  assert.equal(draft.packs, 2); assert.equal(draft.packSize, 64); assert.equal(draft.unit, "miếng");
  assert.equal(draft.amount, 690_000); assert.equal(draft.merchant, "Shopee"); assert.equal(draft.purchasedOn, today);
  assert.equal(draft.category, "diapers"); assert.equal(draft.name, "Merries L"); assert.deepEqual(draft.missing, []);
});

test("khớp món đã có, ngày tương đối và kiểu L64", () => {
  const draft = parsePurchase("hôm qua mua merries L64 345k", [merries], today);
  assert.equal(draft.itemId, "i1"); assert.equal(draft.name, "Bỉm Merries L"); assert.equal(draft.packSize, 64);
  assert.equal(draft.purchasedOn, "2026-09-23"); assert.equal(draft.amount, 345_000);
});

test("đồ gia đình không có số miếng: 1 đơn vị mỗi gói; ngày dd/mm; nơi mua lạ", () => {
  const draft = parsePurchase("đã mua 2 can nước giặt Omo 3.8kg 380.000đ ngày 20/9 ở tiệm cô Lan", [], today);
  assert.equal(draft.category, "household"); assert.equal(draft.unit, "can"); assert.equal(draft.packSize, 1); assert.equal(draft.packs, 2);
  assert.equal(draft.amount, 380_000); assert.equal(draft.purchasedOn, "2026-09-20"); assert.equal(draft.merchant, "tiệm cô Lan");
  assert.equal(draft.name, "Nước giặt Omo 3.8kg");
});

test("thiếu số tiền / số miếng được báo để thẻ xác nhận hỏi", () => {
  const draft = parsePurchase("vừa mua bỉm Huggies", [], today);
  assert.deepEqual(draft.missing, ["amount", "packSize"]); assert.equal(draft.category, "diapers");
  const future = parsePurchase("mua sữa 500k ngày 30/12", [], today);
  assert.equal(future.purchasedOn, "2025-12-30"); assert.equal(future.category, "milk"); assert.equal(future.unit, "hộp");
});
