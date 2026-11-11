import assert from "node:assert/strict";
import test from "node:test";
import { buildBrief, greetingFor } from "../src/lib/brief/build-brief.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";

const now = new Date("2026-09-24T08:30:00+07:00");
const profile = (patch: Partial<FamilyProfile> = {}): FamilyProfile => ({ id: "p1", children: [{ id: "c1", name: "Gold", weightKg: 11, diaperSize: "L", ageMonths: 9 }], pricePreference: "balanced", aiConsent: true, maxBudget: 400_000, onboardedAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", fieldMeta: { "children.c1.weightKg": { source: "user_entered", observedAt: "2026-09-20T00:00:00Z" } }, ...patch });

test("lời chào theo giờ và tên Google", () => {
  assert.equal(greetingFor(new Date("2026-09-24T08:00:00+07:00"), "Dũng"), "Chào buổi sáng, Dũng");
  assert.equal(greetingFor(new Date("2026-09-24T20:00:00+07:00")), "Chào buổi tối");
});

test("hồ sơ đầy đủ: không có việc gấp, luôn có thẻ bắt đầu sổ thu chi", () => {
  const brief = buildBrief({ profile: profile(), displayName: "Dũng", now });
  assert.equal(brief.greeting, "Chào buổi sáng, Dũng");
  assert.match(brief.subtitle, /Không có gì gấp/);
  assert.deepEqual(brief.attention.map((card) => card.id), ["money-setup"]);
  assert.deepEqual(brief.insights, []);
});

test("AI tắt → thẻ bật AI dẫn tới mục Tài khoản", () => {
  const brief = buildBrief({ profile: profile({ aiConsent: false }), now });
  assert.deepEqual(brief.attention.map((card) => card.id), ["ai-off", "money-setup"]);
  assert.equal(brief.attention[0].cta.href, "/family#account");
});

test("có sổ thu chi: thẻ vượt nhịp + hóa đơn sắp đến hạn thay thẻ 'bắt đầu sổ'", async () => {
  const { summarizeMonth } = await import("../src/lib/money/summary.ts");
  const { DEFAULT_CATEGORIES } = await import("../src/lib/money/types.ts");
  const money = summarizeMonth({ month: "2026-09", settings: { openingCash: 0, openingSavings: 0, monthlyPlan: 10_000_000, categories: DEFAULT_CATEGORIES }, totals: { income: 0, expense: 9_000_000, saving: 0 }, budgets: [], goals: [],
    transactions: [{ id: "x", occurredOn: "2026-09-10", content: "Siêu thị", category: "Ăn uống", kind: "expense", amount: 9_000_000, forChild: false, source: "manual" }],
    recurring: [{ id: "r1", name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450_000, dayOfMonth: 26, active: true }] }, now);
  const brief = buildBrief({ profile: profile(), money, now });
  const ids = brief.attention.map((card) => card.id);
  assert.deepEqual(ids, ["money-pace", "due-r1"]);
  assert.match(brief.attention[0].title, /cao hơn kế hoạch 1[0-9]%/);
  assert.equal(brief.attention[1].tone, "warn"); assert.match(brief.attention[1].title, /Internet 450K đến hạn sau 2 ngày/);
});

