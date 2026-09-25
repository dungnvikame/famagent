import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickList } from "../src/lib/money/quick-add.ts";
import { currentCategories, currentCategory, DEFAULT_CATEGORIES, SAVING_CATEGORIES } from "../src/lib/money/types.ts";

test("familiar names kept; only the missing categories from the owner's sheet are added", () => {
  const expense = DEFAULT_CATEGORIES.filter((c) => c.kind === "expense").map((c) => c.name);
  assert.equal(expense[expense.indexOf("Tiền trả nợ") + 1], "Tiền trả nợ quỹ");
  assert.ok(expense.includes("Khác") && !expense.includes("Others"));
  assert.deepEqual(DEFAULT_CATEGORIES.filter((c) => c.kind === "income").map((c) => c.name), ["Lương", "Thưởng", "Đầu tư", "Dự án ngoài", "Gia đình hỗ trợ", "Tiền trả nợ nhận về", "Vay cá nhân", "Vay ngân hàng", "Khác"]);
  assert.deepEqual(SAVING_CATEGORIES, ["Tiết kiệm", "Tiết kiệm cho con", "Tiết kiệm du lịch", "Tiết kiệm mua sắm", "Mua nhà", "Mua xe", "Trả nợ", "Rút tiết kiệm"]);
});

test("names saved during the short-lived v2 list read back as the familiar ones", () => {
  assert.equal(currentCategory("Others", "expense"), "Khác");
  assert.equal(currentCategory("Tiền trả nợ cá nhân", "expense"), "Tiền trả nợ");
  assert.equal(currentCategory("Tiền trả nợ", "expense"), "Tiền trả nợ");
  assert.equal(currentCategory("Tiền trả nợ", "income"), "Tiền trả nợ nhận về");
  assert.equal(currentCategory("Tiền dự án ngoài", "income"), "Dự án ngoài");
  assert.equal(currentCategory("Tiết kiệm cho gia đình", "saving"), "Tiết kiệm");
  assert.equal(currentCategory("Rút tiền tiết kiệm", "saving"), "Rút tiết kiệm");
});

test("a saved list: v2 names merged back, own and archived kept, the new default placed after its neighbour", () => {
  const saved = [{ name: "Ăn uống", kind: "expense" as const }, { name: "Tiền trả nợ", kind: "expense" as const }, { name: "Tiền cho vay", kind: "expense" as const }, { name: "Others", kind: "expense" as const }, { name: "Khác", kind: "expense" as const, archived: true }, { name: "Sữa & bỉm", kind: "expense" as const }, { name: "Giải trí", kind: "expense" as const, archived: true }];
  const list = currentCategories(saved).filter((c) => c.kind === "expense").map((c) => c.name);
  assert.equal(list[list.indexOf("Tiền trả nợ") + 1], "Tiền trả nợ quỹ");
  assert.equal(list.filter((n) => n === "Khác").length, 1);
  assert.equal(currentCategories(saved).find((c) => c.name === "Khác")?.archived, undefined);
  assert.equal(currentCategories(saved).find((c) => c.name === "Giải trí")?.archived, true);
  assert.ok(list.includes("Sữa & bỉm"));
  assert.deepEqual(currentCategories(currentCategories(saved)), currentCategories(saved));
});

test("quick add: saving purpose and fund repayments", () => {
  const drafts = parseQuickList("gửi tiết kiệm du lịch 2tr\ngửi tiết kiệm mua nhà 5tr\ngửi tiết kiệm 1tr\ntrả nợ hụi 3tr\ntrả nợ chị Lan 1tr", { today: "2026-09-25", categories: DEFAULT_CATEGORIES, existing: [] });
  assert.deepEqual(drafts.map((d) => d.category), ["Tiết kiệm du lịch", "Mua nhà", "Tiết kiệm", "Tiền trả nợ quỹ", "Tiền trả nợ"]);
});
