import assert from "node:assert/strict";
import test from "node:test";
import { classifyInbox, moneySummary, purchaseSummary } from "../src/lib/inbox/classify.ts";
import type { ShoppingItem } from "../src/lib/shopping/items.ts";

const today = "2026-09-24";
const merries: ShoppingItem = { id: "i1", name: "Merries L64", category: "diapers", unit: "miếng", packSize: 64, childId: "c1", merchant: "Shopee", status: "active" };
const gold = [{ id: "c1", name: "Gold" }];

test("câu mua đồ dùng → lần mua; tóm tắt kiểu “Merries L64 cho Gold, 369K”", () => {
  const result = classifyInbox("Hôm nay mua bỉm 369k", [merries], today);
  assert.equal(result.kind, "purchase");
  if (result.kind !== "purchase") return;
  assert.equal(result.purchase.amount, 369_000); assert.equal(result.purchase.category, "diapers");
  const matched = classifyInbox("hôm nay mua merries 369k", [merries], today);
  assert.equal(matched.kind === "purchase" && matched.purchase.itemId, "i1");
  if (matched.kind === "purchase") assert.equal(purchaseSummary(matched.purchase, gold, today, "c1"), "Merries L64 (64 miếng) cho Gold, 369K ở Shopee, hôm nay");
});

test("chi thường, thu, câu hỏi, link", () => {
  const lunch = classifyInbox("ăn trưa 80k", [], today);
  assert.equal(lunch.kind, "expense");
  if (lunch.kind === "expense") { assert.equal(lunch.money.category, "Ăn uống"); assert.equal(lunch.money.content, "Ăn trưa"); assert.equal(moneySummary(lunch.money, today), "Chi 80K · Ăn uống · “Ăn trưa” · hôm nay"); }
  const fuel = classifyInbox("hôm qua đổ xăng 100k", [], today);
  assert.equal(fuel.kind === "expense" && fuel.money.category, "Tiêu dùng");
  assert.equal(fuel.kind === "expense" && fuel.money.occurredOn, "2026-09-23");
  const salary = classifyInbox("lương về 25tr", [], today);
  assert.equal(salary.kind, "income"); assert.equal(salary.kind === "income" && salary.money.category, "Lương");
  assert.equal(classifyInbox("mua áo cho chồng 350k", [], today).kind, "expense");
  assert.equal(classifyInbox("tháng này nhà tôi tiêu thế nào?", [], today).kind, "question");
  assert.equal(classifyInbox("mua bỉm dưới 400k", [], today).kind, "question");
  assert.equal(classifyInbox("mua lại bỉm cho Gold", [], today).kind, "question");
  const link = classifyInbox("xem giúp https://shopee.vn/abc-i.1.2 nhé", [], today);
  assert.equal(link.kind, "link"); assert.equal(link.kind === "link" && link.url, "https://shopee.vn/abc-i.1.2");
});

test("review 260924-1609: không nhầm thu, câu hỏi, tiệm tóc; link không https; sữa tắm", () => {
  const kind = (text: string) => classifyInbox(text, [], today);
  for (const text of ["mừng cưới bạn 500k", "ăn uống bình thường 200k", "sữa chất lượng cao 300k", "nhận hàng shopee 369k", "chi phí dự án 2tr"]) assert.equal(kind(text).kind, "expense", text);
  const wedding = kind("mừng cưới bạn 500k"); assert.equal(wedding.kind === "expense" && wedding.money.category, "Hiếu hỉ");
  const hair = kind("tiệm tóc 100k"); assert.equal(hair.kind === "expense" && hair.money.category, "Tiêu dùng");
  const paid = kind("được bạn trả 200k"); assert.equal(paid.kind, "income"); assert.equal(paid.kind === "income" && paid.money.category, "Tiền trả nợ nhận về");
  assert.equal(kind("lương về 25tr").kind, "income");
  assert.equal(kind("mình tiêu 5tr ăn uống là nhiều không").kind, "question");
  const link = kind("shopee.vn/Bim-Merries-i.1.2"); assert.equal(link.kind === "link" && link.url, "https://shopee.vn/Bim-Merries-i.1.2");
  const soap = kind("vừa mua sữa tắm cho bé 150k"); assert.equal(soap.kind === "purchase" && soap.purchase.category, "hygiene");
});
