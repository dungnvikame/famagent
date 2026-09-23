import assert from "node:assert/strict";
import test from "node:test";
import { extractShoppingRules } from "../src/lib/ai/shopping/extract.ts";

test("không coi từ 'dưới' là tên bé khi hỏi ngân sách", () => {
  const extracted = extractShoppingRules("Tìm bỉm ban đêm cho bé dưới 400k");
  assert.equal(extracted.childName, null);
  assert.equal(extracted.maxTotalPriceVnd, 400000);
  assert.equal(extracted.nightUse, true);
});
