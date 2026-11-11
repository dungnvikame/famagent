import assert from "node:assert/strict";
import test from "node:test";
import { parseVnd } from "../src/lib/ai/onboarding/extract-rules.ts";
import { profileSummary } from "../src/lib/ai/onboarding/templates.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

test("parseVnd: đơn vị tiền phổ biến, bỏ số không phải tiền", () => {
  assert.equal(parseVnd("dưới 400k"), 400_000);
  assert.equal(parseVnd("1,2 triệu"), 1_200_000);
  assert.equal(parseVnd("350.000đ"), 350_000);
  assert.equal(parseVnd("ngân sách 500"), 500_000);
  assert.equal(parseVnd("bé 14 tháng 10kg"), null);
});

test("tóm tắt chỉ nêu thông tin gia đình, không nêu sở thích mua sắm", () => {
  const profile: FamilyProfile = {
    id: "p1", adultsCount: 2, pricePreference: "balanced", maxBudget: 400_000, mainConcern: "leak", aiConsent: false, updatedAt: "2026-09-23T10:00:00.000Z",
    children: [{ id: "c1", name: "Gold", weightKg: 10, diaperSize: "L" }],
  };
  const summary = profileSummary(profile).join(" | ");
  // The onboarding summary lists family facts only; shopping preferences live in chat/Family page.
  assert.match(summary, /2 người lớn/);
  assert.match(summary, /Bé Gold: 10 kg/);
  assert.doesNotMatch(summary, /Cân bằng|size|400\.000/);
});
