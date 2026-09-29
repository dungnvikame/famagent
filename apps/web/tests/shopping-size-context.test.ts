import assert from "node:assert/strict";
import test from "node:test";
import { mergeIntent } from "../src/lib/ai/shopping/context-merger.ts";
import { extractShoppingRules } from "../src/lib/ai/shopping/extract.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";
import { findPath } from "../src/lib/shopping/find-href.ts";

const family = (child: Record<string, unknown>): FamilyProfile => ({
  id: "p", children: [{ id: "c1", name: "Gold", ...child }], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-29T00:00:00Z",
} as FamilyProfile);
const merge = (message: string, profile: FamilyProfile) => mergeIntent(extractShoppingRules(message), profile, null).requiredAttributes;

test("hồ sơ có cả cân nặng và size: chỉ lấy cân nặng", () => {
  const attrs = merge("mua bỉm cho Gold", family({ weightKg: 13, diaperSize: "M" }));
  assert.equal(attrs.weightKg, 13);
  assert.equal(attrs.sizeLabel, undefined);
});

test("hồ sơ chỉ có size thì dùng size", () => {
  const attrs = merge("mua bỉm cho Gold", family({ diaperSize: "M" }));
  assert.equal(attrs.weightKg, undefined);
  assert.equal(attrs.sizeLabel, "M");
});

test("tin nhắn nêu size thì giữ size đó, không kéo cân nặng hồ sơ", () => {
  const attrs = merge("mua bỉm size L cho Gold", family({ weightKg: 13, diaperSize: "M" }));
  assert.equal(attrs.sizeLabel, "L");
  assert.equal(attrs.weightKg, undefined);
});

test("tin nhắn nêu cân nặng thắng hồ sơ", () => {
  const attrs = merge("bỉm cho Gold nặng 9kg", family({ weightKg: 13, diaperSize: "XL" }));
  assert.equal(attrs.weightKg, 9);
  assert.equal(attrs.sizeLabel, undefined);
});

test("liên kết tìm bỉm: cân nặng thay cho size, size chỉ khi chưa biết cân nặng", () => {
  assert.equal(findPath({ weightKg: 13, diaperSize: "M" }), "/shopping/find?weightKg=13");
  assert.equal(findPath({ diaperSize: "M" }), "/shopping/find?size=M");
  assert.equal(findPath({}), "/shopping/find");
  assert.equal(findPath(undefined), "/shopping/find");
});
