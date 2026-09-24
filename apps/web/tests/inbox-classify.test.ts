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
