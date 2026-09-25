import assert from "node:assert/strict";
import test from "node:test";
import { currentCategories, currentCategory, DEFAULT_CATEGORIES, SAVING_CATEGORIES } from "../src/lib/money/types.ts";

test("v2 category set matches the owner's sheet", () => {
  assert.deepEqual(DEFAULT_CATEGORIES.filter((c) => c.kind === "income").map((c) => c.name), ["Lương", "Đầu tư", "Thưởng", "Tiền dự án ngoài", "Vay cá nhân", "Vay ngân hàng", "Tiền trả nợ", "Gia đình hỗ trợ", "Others"]);
  assert.equal(DEFAULT_CATEGORIES.filter((c) => c.kind === "expense").length, 19);
  assert.deepEqual(SAVING_CATEGORIES, ["Tiết kiệm cho gia đình", "Tiết kiệm cho con", "Tiết kiệm du lịch", "Tiết kiệm mua sắm", "Mua nhà", "Mua xe", "Trả nợ", "Rút tiền tiết kiệm"]);
});

test("old names read as v2 names, per kind", () => {
  assert.equal(currentCategory("Tiền trả nợ", "expense"), "Tiền trả nợ cá nhân");
  assert.equal(currentCategory("Tiền trả nợ", "income"), "Tiền trả nợ");
  assert.equal(currentCategory("Tiền trả nợ nhận về", "income"), "Tiền trả nợ");
  assert.equal(currentCategory("Khác", "expense"), "Others");
  assert.equal(currentCategory("Tiết kiệm", "saving"), "Tiết kiệm cho gia đình");
  assert.equal(currentCategory("Rút tiết kiệm", "saving"), "Rút tiền tiết kiệm");
  assert.equal(currentCategory("Sữa & bỉm", "expense"), "Sữa & bỉm");
});

test("a saved v1 list becomes v2: renamed, merged, custom and archived kept, new defaults added", () => {
  const saved = [{ name: "Khác", kind: "expense" as const }, { name: "Others", kind: "expense" as const, archived: true }, { name: "Tiền trả nợ", kind: "expense" as const }, { name: "Sữa & bỉm", kind: "expense" as const }, { name: "Giải trí", kind: "expense" as const, archived: true }, { name: "Dự án ngoài", kind: "income" as const }];
  const list = currentCategories(saved);
  const names = (kind: "expense" | "income") => list.filter((c) => c.kind === kind).map((c) => c.name);
  assert.equal(names("expense").filter((n) => n === "Others").length, 1);
  assert.equal(list.find((c) => c.name === "Others" && c.kind === "expense")?.archived, undefined);
  assert.ok(names("expense").includes("Tiền trả nợ cá nhân"));
  assert.ok(names("expense").includes("Tiền trả nợ quỹ"));
  assert.ok(names("expense").includes("Sữa & bỉm"));
  assert.equal(list.find((c) => c.name === "Giải trí")?.archived, true);
  assert.ok(names("income").includes("Tiền dự án ngoài") && !names("income").includes("Dự án ngoài"));
  assert.deepEqual(currentCategories(list), list);
});
