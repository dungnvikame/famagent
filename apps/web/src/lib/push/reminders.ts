// Proactive reminders (core journey spec §7): which attention insights become a push today. Same engine as Home, so
// "Đừng nhắc việc này nữa" / "Chưa cần" silence the push too. Pure; the cron routes load data and send.
import { silenced, type Insight, type InsightFeedback } from "../attention/engine.ts";
import type { FamilyPolicy } from "../policy/family-policy.ts";
import type { ItemEstimate } from "../shopping/items.ts";

/** An item estimated as out is pushed at most this many times in two weeks (then the family has seen it). */
export const MAX_OUT_REMINDERS = 3;
export const PUSH_PER_DAY = 2;
export interface Reminder { key: string; title: string; body: string; url: string; tag: string }

export interface PushContext { feedback: InsightFeedback[]; sentToday: ReadonlySet<string>; recent: ReadonlyMap<string, number>; today: string; policy: FamilyPolicy; estimates: ItemEstimate[] }

/** Stock at ≤ the policy's push threshold, unusual category spend, bills due today/tomorrow — at most 2 a day. */
export function remindersFor(insights: Insight[], context: PushContext, limit = PUSH_PER_DAY): Reminder[] {
  return insights.filter((insight) => {
    if (silenced(insight.key, context.feedback, context.today) || context.sentToday.has(insight.key)) return false;
    if (insight.kind === "stock_low") {
      const estimate = context.estimates.find((entry) => entry.item.id === insight.subjectId);
      if (!estimate || estimate.daysLeft === null || estimate.daysLeft > context.policy.lowStockPushDays) return false;
      return !(estimate.daysLeft === 0 && (context.recent.get(insight.key) ?? 0) >= MAX_OUT_REMINDERS);
    }
    if (insight.kind === "bill_due") return insight.badge === "Nay" || insight.badge === "1d";
    return insight.kind === "category_spike";
  }).slice(0, limit).map((insight) => ({ key: insight.key, title: insight.title, body: insight.detail, url: insight.cta.href.startsWith("/") ? insight.cta.href : "/home", tag: insight.key }));
}
