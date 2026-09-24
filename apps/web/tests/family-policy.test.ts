import assert from "node:assert/strict";
import test from "node:test";
import { starterSteps } from "../src/lib/attention/starters.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";
import { familyPolicy } from "../src/lib/policy/family-policy.ts";

const profile = (household: FamilyProfile["household"]): FamilyProfile => ({ id: "p", children: [], pricePreference: "balanced", aiConsent: false, updatedAt: "2026-09-24T00:00:00Z", household });

test("phong cách → Family Policy: tiết kiệm nhạy chi và so giá, tiện lợi nhắc sớm", () => {
  const saving = familyPolicy(profile({ style: "saving" })); const easy = familyPolicy(profile({ style: "convenience" }));
  assert.ok(saving.spendAlertPct < easy.spendAlertPct); assert.ok(saving.suggestCheaper && !easy.suggestCheaper);
  assert.ok(easy.reorderWindowDays > saving.reorderWindowDays); assert.equal(easy.waitForSale, false);
  assert.equal(familyPolicy(null).style, "balanced");
});

test("3 bước khởi đầu theo ưu tiên, biến mất khi đã làm", () => {
  assert.deepEqual(starterSteps(profile({ focus: ["money"] }), { transactions: 0, items: 0 }).map((step) => step.id), ["finance", "transaction", "item"]);
  assert.deepEqual(starterSteps(profile({ focus: ["replenish", "money"] }), { transactions: 0, items: 0 }).map((step) => step.id), ["item", "transaction", "finance"]);
  assert.deepEqual(starterSteps(profile({ focus: ["money"], monthlySpend: 20_000_000 }), { transactions: 3, items: 0 }).map((step) => step.id), ["item"]);
});
