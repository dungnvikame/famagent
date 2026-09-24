import assert from "node:assert/strict";
import test from "node:test";
import { remindersFor } from "../src/lib/push/reminders.ts";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";
import { isImageDataUrl, isReceipt, receiptDrafts } from "../src/lib/shopping/receipt.ts";

const merries: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, brand: "Merries", status: "active" };

test("ảnh đơn 3 dòng → 3 nháp, khớp món đã có, số của ảnh thắng", () => {
  const reply = { merchant: "Shopee", date: "2026-09-22", lines: [
    { name: "Bỉm quần Merries size L 64 miếng", amount: 690_000, packs: 2, piecesPerPack: 64, unit: "miếng" },
    { name: "Khăn ướt Bobby không mùi", amount: 135_000, packs: 3, piecesPerPack: 80, unit: "tờ" },
    { name: "Nước giặt Omo Matic 3.6kg", amount: 189_000, packs: 1, piecesPerPack: null, unit: null },
  ] };
  assert.equal(isReceipt(reply), true);
  const drafts = receiptDrafts(reply, [merries], "2026-09-24");
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0].itemId, "i1"); assert.equal(drafts[0].packs, 2); assert.equal(drafts[0].amount, 690_000); assert.equal(drafts[0].merchant, "Shopee"); assert.equal(drafts[0].purchasedOn, "2026-09-22");
  assert.equal(drafts[1].category, "wipes"); assert.equal(drafts[1].packSize, 80);
  assert.equal(drafts[2].category, "household"); assert.equal(drafts[2].packSize, 1);
});

test("trả lời sai dạng bị loại; ngày tương lai về hôm nay; chỉ nhận data URL ảnh", () => {
  assert.equal(isReceipt({ merchant: null, date: null, lines: [{ name: "x", amount: -1, packs: 1, piecesPerPack: null, unit: null }] }), false);
  assert.equal(isReceipt({ merchant: null, date: "22/9", lines: [] }), false);
  assert.equal(receiptDrafts({ merchant: null, date: "2027-01-01", lines: [{ name: "Sữa Meiji", amount: 500_000, packs: 1, piecesPerPack: null, unit: "hộp" }] }, [], "2026-09-24")[0].purchasedOn, "2026-09-24");
  assert.equal(isImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
  assert.equal(isImageDataUrl("data:text/html;base64,PGh0bWw+"), false);
  assert.equal(isImageDataUrl("https://example.com/a.jpg"), false);
});

test("nhắc: món ≤ 3 ngày, chưa nhắc hôm nay, tối đa 2", () => {
  const now = new Date(2026, 8, 24, 9);
  const items = ["a", "b", "c", "d"].map((id): ShoppingItem => ({ ...merries, id, name: `Món ${id}` }));
  const purchases = [["a", 10], ["b", 20], ["c", 5], ["d", 64]].map(([itemId, unitCount]) => ({ id: crypto.randomUUID(), itemId: itemId as string, productName: "x", amount: 100_000, packs: 1, unitCount: unitCount as number, purchasedOn: "2026-09-23" }));
  const estimates = estimateItems(items, purchases, () => 6, now);
  const reminders = remindersFor(estimates, new Set(["c"]));
  assert.deepEqual(reminders.map((reminder) => reminder.itemId), ["a", "b"]);
  assert.match(reminders[0].title, /Món a còn khoảng 0 ngày|Món a có thể đã hết/);
  assert.equal(remindersFor(estimates, new Set(["a", "b", "c"])).length, 0);
});

test("món đã hết chỉ được nhắc tối đa 3 lần trong 2 tuần", () => {
  const now = new Date(2026, 8, 24, 9);
  const out = estimateItems([merries], [{ id: "p", itemId: "i1", productName: "x", amount: 1, packs: 1, unitCount: 6, purchasedOn: "2026-09-20" }], () => 6, now);
  assert.equal(out[0].daysLeft, 0);
  assert.equal(remindersFor(out, new Set(), 2, new Map([["i1", 2]])).length, 1);
  assert.equal(remindersFor(out, new Set(), 2, new Map([["i1", 3]])).length, 0);
});
