import assert from "node:assert/strict";
import test from "node:test";
import { extractRules } from "../src/lib/ai/intent-rules.ts";

test("không coi từ 'dưới' là tên bé khi hỏi ngân sách", () => {
  const extracted = extractRules("Tìm bỉm ban đêm cho bé dưới 400k");
  assert.equal(extracted.childName, null);
  assert.equal(extracted.maxPrice, 400000);
  assert.equal(extracted.nightUse, true);
});
