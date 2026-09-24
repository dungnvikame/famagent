import assert from "node:assert/strict";
import test from "node:test";
import { allInsights, buildAttention, feedbackFor, greetingFor, silenced, type FamilySnapshot } from "../src/lib/attention/engine.ts";
import { categorySpikes } from "../src/lib/attention/spikes.ts";
import type { FamilyProfile } from "../src/lib/experience/types.ts";
import type { MonthSummary } from "../src/lib/money/summary.ts";
import type { MoneyTransaction } from "../src/lib/money/types.ts";
import { familyPolicy } from "../src/lib/policy/family-policy.ts";
import { estimateItems, type ShoppingItem } from "../src/lib/shopping/items.ts";

const now = new Date(2026, 8, 24, 9);
const profile: FamilyProfile = { id: "p", children: [{ id: "c1", name: "Gold", ageMonths: 14, weightKg: 10.6, diaperSize: "L" }], pricePreference: "balanced", aiConsent: true, updatedAt: "2026-09-24T00:00:00Z", household: { style: "balanced" } };
const bim: ShoppingItem = { id: "i1", name: "Bỉm Merries L", category: "diapers", unit: "miếng", packSize: 64, childId: "c1", merchant: "Shopee", status: "active" };
const month = (patch: Partial<MonthSummary> = {}): MonthSummary => ({ month: "2026-09", income: 30_000_000, expense: 18_200_000, saving: 3_000_000, net: 0, plan: 20_000_000, remainingOfPlan: 1_800_000, expectedExpense: 21_600_000, paceRatio: 1.08, childSpend: 0, byCategory: [], upcoming: [], balances: { cash: 0, savings: 0 }, insights: [], transactionCount: 40, ...patch });
const snapshot = (patch: Partial<FamilySnapshot> = {}): FamilySnapshot => ({ profile, conversations: [], month: month(), history: [], goals: [{ id: "g", name: "Quỹ", targetAmount: 100_000_000, savedAmount: 0, monthlyPlan: 3_000_000 }], estimates: estimateItems([bim], [{ id: "p1", itemId: "i1", productName: "Bỉm", amount: 369_000, packs: 1, unitCount: 64, purchasedOn: "2026-09-14" }], () => 5, now), plan: [], counts: { transactions: 40, items: 1 }, ...patch });

test("Home: bỉm của Gold còn ~N ngày, chi tiêu cao hơn kế hoạch; tối đa 3 thẻ; mỗi thẻ có nguồn và CTA", () => {
  const home = buildAttention(snapshot(), familyPolicy(profile), [], now);
  assert.deepEqual(home.attention.map((item) => item.kind), ["stock_low"]);
  assert.match(home.attention[0].title, /Bỉm Merries L của Gold/); assert.match(home.attention[0].detail, /Có thể còn khoảng 2 ngày/);
  assert.equal(home.attention[0].cta.label, "Mua lại"); assert.ok(home.attention[0].source);
  // Saving style alerts at 5%: the 8% pace shows.
  const saving = buildAttention(snapshot({ profile: { ...profile, household: { style: "saving" } } }), familyPolicy({ household: { style: "saving" } }), [], now);
  assert.ok(saving.attention.some((item) => item.kind === "money_pace" && /cao hơn kế hoạch khoảng 8%/.test(item.detail) && item.cta.label === "Xem nguyên nhân"));
  assert.ok(buildAttention(snapshot({ conversations: [{ id: "c", title: "Bỉm", updatedAt: "", turns: [{ id: "t", role: "assistant", text: "?", createdAt: "", choices: ["a"] }] }], profile: { ...profile, children: [{ id: "c1", name: "Gold", ageMonths: 14 }, { id: "c2", name: "Bin", ageMonths: 10 }] } }), familyPolicy(profile), [], now).attention.length <= 3);
  assert.equal(greetingFor(new Date(2026, 8, 24, 20), "Dũng"), "Chào buổi tối, Dũng");
});

test("Đang ổn: tiết kiệm đúng tiến độ, chi trong nhịp, không món gấp", () => {
  const calm = buildAttention(snapshot({ month: month({ paceRatio: 1.02 }), estimates: [] }), familyPolicy(profile), [], now);
  assert.ok(calm.fine.some((line) => /^Tiết kiệm: đúng tiến độ/.test(line)));
  assert.ok(calm.fine.some((line) => /^Chi tiêu: trong nhịp/.test(line)));
  assert.match(calm.subtitle, /Không có gì cần chú ý/);
});

test("phản hồi: Chưa cần ẩn 3 ngày, Không đúng 7 ngày, Đừng nhắc ẩn hẳn", () => {
  const key = "stock_low:i1";
  assert.equal(feedbackFor(key, "later", now).until, "2026-09-27");
  assert.equal(silenced(key, [feedbackFor(key, "later", now)], "2026-09-26"), true);
  assert.equal(silenced(key, [feedbackFor(key, "later", now)], "2026-09-27"), false);
  assert.equal(silenced(key, [feedbackFor(key, "mute", now)], "2027-01-01"), true);
  assert.equal(buildAttention(snapshot(), familyPolicy(profile), [feedbackFor(key, "mute", now)], now).attention.some((item) => item.key === key), false);
  assert.equal(allInsights(snapshot(), familyPolicy(profile), now).some((item) => item.key === key), true, "push/brief still see it before feedback");
});

test("chi bất thường theo nhóm/tuần", () => {
  const tx = (occurredOn: string, amount: number, category = "Ăn uống"): MoneyTransaction => ({ id: crypto.randomUUID(), occurredOn, content: "x", category, kind: "expense", amount, forChild: false, source: "manual" });
  const history = [tx("2026-09-20", 800_000), tx("2026-09-22", 520_000), tx("2026-09-12", 1_000_000), tx("2026-09-05", 1_000_000), tx("2026-08-28", 1_000_000), tx("2026-08-22", 1_000_000), tx("2026-09-23", 5_000_000, "Tiền trả góp")];
  const [spike] = categorySpikes(history, now, 30);
  assert.equal(spike.category, "Ăn uống"); assert.equal(spike.pct, 32);
  assert.equal(categorySpikes(history, now, 40).length, 0);
});
