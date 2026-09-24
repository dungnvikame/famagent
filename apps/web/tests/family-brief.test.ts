import assert from "node:assert/strict";
import test from "node:test";
import { buildBrief, diaperSizeFor, greetingFor } from "../src/lib/brief/build-brief.ts";
import type { Conversation, FamilyProfile } from "../src/lib/experience/types.ts";

const now = new Date("2026-09-24T08:30:00+07:00");
const profile = (patch: Partial<FamilyProfile> = {}): FamilyProfile => ({ id: "p1", children: [{ id: "c1", name: "Gold", weightKg: 11, diaperSize: "L", ageMonths: 9 }], pricePreference: "balanced", aiConsent: true, maxBudget: 400_000, onboardedAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", fieldMeta: { "children.c1.weightKg": { source: "user_entered", observedAt: "2026-09-20T00:00:00Z" } }, ...patch });

test("lời chào theo giờ và tên Google", () => {
  assert.equal(greetingFor(new Date("2026-09-24T08:00:00+07:00"), "Dũng"), "Chào buổi sáng, Dũng");
  assert.equal(greetingFor(new Date("2026-09-24T20:00:00+07:00")), "Chào buổi tối");
});

test("size bỉm theo cân nặng khớp dải onboarding", () => {
  assert.equal(diaperSizeFor(4), "NB/S"); assert.equal(diaperSizeFor(6), "M"); assert.equal(diaperSizeFor(11), "L"); assert.equal(diaperSizeFor(13), "XL"); assert.equal(diaperSizeFor(16), "XXL");
});

test("hồ sơ đầy đủ: không có việc gấp, luôn có thẻ bắt đầu sổ thu chi và insight về bé", () => {
  const brief = buildBrief({ profile: profile(), conversations: [], savedCount: 0, displayName: "Dũng", now });
  assert.equal(brief.greeting, "Chào buổi sáng, Dũng");
  assert.match(brief.subtitle, /Không có gì gấp/);
  assert.deepEqual(brief.attention.map((card) => card.id), ["money-setup"]);
  assert.match(brief.insights[0].text, /Bé Gold 9 tháng · .*size L/);
});

test("thiếu cân nặng → thẻ cảnh báo dẫn tới Gia đình; cân nặng cũ ≥60 ngày → nhắc cập nhật", () => {
  const missing = buildBrief({ profile: profile({ children: [{ id: "c1", name: "Gold" }] }), conversations: [], savedCount: 0, now });
  assert.equal(missing.attention[0].id, "weight-c1"); assert.equal(missing.attention[0].tone, "warn"); assert.equal(missing.attention[0].cta.href, "/family");
  assert.match(missing.subtitle, /1 việc cần bạn xem/);
  const stale = buildBrief({ profile: profile({ fieldMeta: { "children.c1.weightKg": { source: "user_entered", observedAt: "2026-06-01T00:00:00Z" } } }), conversations: [], savedCount: 0, now });
  assert.equal(stale.attention[0].id, "stale-c1"); assert.match(stale.attention[0].title, /115 ngày/);
});

test("câu hỏi làm rõ chưa trả lời → thẻ 'đang chờ' deep-link tới hội thoại; AI tắt → thẻ bật AI", () => {
  const conversation: Conversation = { id: "conv1", title: "Bỉm đêm cho Gold", updatedAt: "2026-09-23T10:00:00Z", turns: [{ id: "t1", role: "user", text: "bỉm đêm", createdAt: "2026-09-23T10:00:00Z" }, { id: "t2", role: "assistant", text: "Ngân sách?", createdAt: "2026-09-23T10:00:01Z", choices: ["Dưới 300k", "Giá nào cũng được"] }] };
  const brief = buildBrief({ profile: profile({ aiConsent: false }), conversations: [conversation], savedCount: 2, now });
  const ids = brief.attention.map((card) => card.id);
  assert.deepEqual(ids, ["pending-conv1", "ai-off", "money-setup"]);
  assert.equal(brief.attention[0].cta.href, "/agent?c=conv1");
  assert.ok(brief.insights.some((item) => /2 sản phẩm/.test(item.text)));
});

test("size trong hồ sơ lệch cân nặng → insight gợi ý lên size", () => {
  const brief = buildBrief({ profile: profile({ children: [{ id: "c1", name: "Gold", weightKg: 13, diaperSize: "L" }] }), conversations: [], savedCount: 0, now });
  assert.match(brief.insights[0].text, /hợp size XL, hồ sơ đang ghi size L/);
});

test("có sổ thu chi: thẻ vượt nhịp + hóa đơn sắp đến hạn thay thẻ 'bắt đầu sổ'", async () => {
  const { summarizeMonth } = await import("../src/lib/money/summary.ts");
  const { DEFAULT_CATEGORIES } = await import("../src/lib/money/types.ts");
  const money = summarizeMonth({ month: "2026-09", settings: { openingCash: 0, openingSavings: 0, monthlyPlan: 10_000_000, categories: DEFAULT_CATEGORIES }, totals: { income: 0, expense: 9_000_000, saving: 0 }, budgets: [], goals: [],
    transactions: [{ id: "x", occurredOn: "2026-09-10", content: "Siêu thị", category: "Ăn uống", kind: "expense", amount: 9_000_000, forChild: false, source: "manual" }],
    recurring: [{ id: "r1", name: "Internet", category: "Tiêu dùng", kind: "expense", amount: 450_000, dayOfMonth: 26, active: true }] }, now);
  const brief = buildBrief({ profile: profile(), conversations: [], savedCount: 0, money, now });
  const ids = brief.attention.map((card) => card.id);
  assert.deepEqual(ids, ["money-pace", "due-r1"]);
  assert.match(brief.attention[0].title, /cao hơn kế hoạch 1[0-9]%/);
  assert.equal(brief.attention[1].tone, "warn"); assert.match(brief.attention[1].title, /Internet 450K đến hạn sau 2 ngày/);
});
