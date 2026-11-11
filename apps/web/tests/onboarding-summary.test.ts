import assert from "node:assert/strict";
import test from "node:test";
import { profileSummary } from "../src/lib/ai/onboarding/templates.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";


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
