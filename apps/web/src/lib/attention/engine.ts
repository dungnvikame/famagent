// Attention engine (core journey spec §3, §7, §9, §10): one place that turns Family State into "cần chú ý" and "đang
// ổn". Home, push reminders and the weekly brief all read it, so a "Đừng nhắc việc này nữa" silences every surface.
// Pure; the caller loads the snapshot (browser for Home, pg for the cron).
import type { Conversation, FamilyProfile } from "../experience/types.ts";
import { childAgeMonths } from "../experience/profile-mapper.ts";
import type { MonthSummary } from "../money/summary.ts";
import { shortVnd } from "../money/summary.ts";
import type { MoneyGoal, MoneyTransaction } from "../money/types.ts";
import type { FamilyPolicy } from "../policy/family-policy.ts";
import type { ItemEstimate } from "../shopping/items.ts";
import { upcomingStages } from "../shopping/stages.ts";
import type { PlanEntry } from "../shopping/plan.ts";
import { starterSteps, type StarterStep } from "./starters.ts";
import { categorySpikes } from "./spikes.ts";

export const FEEDBACK_VERDICTS = ["useful", "wrong", "later", "mute"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];
/** One answer to an insight; `until` (YYYY-MM-DD) hides it until then, mute hides it for good. */
export interface InsightFeedback { key: string; verdict: FeedbackVerdict; until?: string }
export const FEEDBACK_LABELS: Record<FeedbackVerdict, string> = { useful: "Hữu ích", wrong: "Không đúng", later: "Chưa cần", mute: "Đừng nhắc việc này nữa" };
/** Days an insight stays hidden after "Chưa cần" / "Không đúng". */
export const HIDE_DAYS: Record<FeedbackVerdict, number> = { useful: 0, wrong: 7, later: 3, mute: 0 };

export type InsightKind = "pending_question" | "stock_low" | "money_pace" | "category_spike" | "bill_due" | "stage_size" | "weight_missing" | "weight_stale";
export interface Insight {
  /** kind:subject — the feedback key. */
  key: string;
  kind: InsightKind;
  subjectId?: string;
  tone: "warn" | "info" | "ok";
  badge: string;
  title: string;
  detail: string;
  /** Where the numbers come from (spec: mọi con số có nguồn). */
  source: string;
  cta: { label: string; href: string };
  priority: number;
}

export interface FamilySnapshot {
  profile: FamilyProfile | null;
  displayName?: string;
  conversations: Conversation[];
  month: MonthSummary | null;
  /** Ledger rows of the last ~120 days (spikes). */
  history: MoneyTransaction[];
  goals: MoneyGoal[];
  estimates: ItemEstimate[];
  plan: PlanEntry[];
  counts: { transactions: number; items: number };
}

export interface Attention { greeting: string; subtitle: string; attention: Insight[]; fine: string[]; starters: StarterStep[] }

const DAY_MS = 86_400_000;
const WEIGHT_STALE_DAYS = 60;
export const MAX_ATTENTION = 3;
const weekday = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const localDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function greetingFor(now: Date, name?: string): string {
  const hour = now.getHours();
  const part = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  return name ? `${part}, ${name}` : part;
}

/** Hidden by feedback today? mute = always; later/wrong = until the stored day. */
export function silenced(key: string, feedback: InsightFeedback[], today: string): boolean {
  const entry = feedback.find((item) => item.key === key);
  return Boolean(entry && (entry.verdict === "mute" || (entry.until !== undefined && entry.until > today)));
}

/** Every insight the state supports, before feedback and the top-3 cut (push and the weekly brief use this too). */
export function allInsights(snapshot: FamilySnapshot, policy: FamilyPolicy, now = new Date()): Insight[] {
  const { profile, month, estimates } = snapshot;
  const out: Insight[] = [];
  const children = profile?.children ?? [];
  const nameOf = (childId?: string) => { const child = children.find((entry) => entry.id === childId) ?? (children.length === 1 ? children[0] : undefined); return child?.name; };

  const pending = snapshot.conversations.find((item) => { const last = item.turns.at(-1); return last?.role === "assistant" && (last.choices?.length ?? 0) > 0; });
  if (pending) out.push({ key: `pending_question:${pending.id}`, kind: "pending_question", subjectId: pending.id, tone: "warn", badge: "!", title: "FamAgent đang chờ bạn trả lời", detail: `“${pending.title}” — chọn một gợi ý để tiếp tục.`, source: "Từ cuộc trò chuyện gần nhất", cta: { label: "Trả lời", href: `/agent?c=${pending.id}` }, priority: 90 });

  // "Bỉm của Gold — có thể còn khoảng 4 ngày. Mua lại" (spec §3).
  for (const estimate of estimates) {
    if (!estimate.known || estimate.daysLeft === null || estimate.daysLeft > policy.reorderWindowDays) continue;
    const { item, daysLeft } = estimate;
    const who = nameOf(item.childId);
    const title = `${item.name}${who && !item.name.includes(who) ? ` của ${who}` : ""}`;
    out.push({ key: `stock_low:${item.id}`, kind: "stock_low", subjectId: item.id, tone: daysLeft <= 3 ? "warn" : "info", badge: daysLeft === 0 ? "Hết" : `${daysLeft}d`, title, detail: `${daysLeft === 0 ? "Có thể đã hết" : `Có thể còn khoảng ${daysLeft} ngày`}${estimate.lastPackPrice ? ` · lần trước ${shortVnd(estimate.lastPackPrice)}/gói${item.merchant ? ` ở ${item.merchant}` : ""}` : ""}.`, source: `Từ ${estimate.purchaseCount} lần mua · ${estimate.rateSource === "learned" ? "nhịp dùng của nhà mình" : estimate.rateSource === "set" ? "mức dùng bạn đặt" : "mức dùng ước tính"}`, cta: { label: "Mua lại", href: item.productId ? `/agent?q=${encodeURIComponent(`Mua lại ${item.name}`)}` : "/shopping" }, priority: 80 + (daysLeft <= 3 ? 10 : 0) - daysLeft });
  }

  if (month && month.transactionCount > 0 && month.plan && month.paceRatio !== undefined && month.paceRatio > 1 + policy.spendAlertPct / 100) {
    const pct = Math.round((month.paceRatio - 1) * 100);
    out.push({ key: `money_pace:${month.month}`, kind: "money_pace", subjectId: month.month, tone: "warn", badge: `+${pct}%`, title: "Chi tiêu tháng này", detail: `Đang cao hơn kế hoạch khoảng ${pct}% — dự kiến cuối tháng ${shortVnd(month.expectedExpense ?? month.expense)} / kế hoạch ${shortVnd(month.plan)}.`, source: `Từ ${month.transactionCount} khoản trong sổ Tiền`, cta: { label: "Xem nguyên nhân", href: `/agent?q=${encodeURIComponent("Tháng này nhà tôi tiêu thế nào?")}` }, priority: 70 });
  }

  for (const spike of categorySpikes(snapshot.history, now, policy.spikePct).slice(0, 1)) {
    out.push({ key: `category_spike:${spike.category}:${spike.week}`, kind: "category_spike", subjectId: spike.category, tone: "info", badge: `+${spike.pct}%`, title: `Chi ${spike.category.toLocaleLowerCase("vi")} tuần này`, detail: `Cao hơn trung bình 4 tuần trước khoảng ${spike.pct}% (${shortVnd(spike.week7)} so với ~${shortVnd(spike.average)}).`, source: "Từ sổ Tiền 5 tuần gần nhất", cta: { label: "Xem chi tiết", href: `/money#month` }, priority: 65 });
  }

  for (const bill of month?.upcoming.filter((item) => item.kind === "expense" && item.daysLeft <= 3).slice(0, 2) ?? []) {
    out.push({ key: `bill_due:${bill.id}:${bill.dueOn}`, kind: "bill_due", subjectId: bill.id, tone: bill.daysLeft <= 1 ? "warn" : "info", badge: bill.daysLeft === 0 ? "Nay" : `${bill.daysLeft}d`, title: `${bill.name} ${shortVnd(bill.amount)}`, detail: bill.daysLeft === 0 ? "Đến hạn hôm nay." : `Đến hạn sau ${bill.daysLeft} ngày.`, source: "Từ khoản định kỳ trong Tiền", cta: { label: "Xem", href: "/money#plan" }, priority: 60 });
  }

  for (const stage of upcomingStages(profile, snapshot.plan, now).filter((entry) => entry.key.startsWith("stage:size-"))) {
    out.push({ key: `stage_size:${stage.key}`, kind: "stage_size", subjectId: stage.childId, tone: "info", badge: "Size", title: stage.title, detail: stage.detail, source: "Từ cân nặng trong hồ sơ", cta: { label: "Xem kế hoạch", href: "/shopping" }, priority: 50 });
  }

  for (const child of children) {
    const who = child.name ? `bé ${child.name}` : "bé";
    const age = childAgeMonths(child, now);
    if (age !== undefined && age >= 36) continue;
    if (child.weightKg === undefined) { out.push({ key: `weight_missing:${child.id}`, kind: "weight_missing", subjectId: child.id, tone: "info", badge: "?", title: `Chưa có cân nặng của ${who}`, detail: "Cân nặng quyết định size bỉm và ước tính đồ dùng.", source: "Từ hồ sơ gia đình", cta: { label: "Bổ sung", href: "/family" }, priority: 40 }); continue; }
    const observed = profile?.fieldMeta?.[`children.${child.id}.weightKg`]?.observedAt;
    const days = observed ? Math.floor((now.getTime() - new Date(observed).getTime()) / DAY_MS) : null;
    if (days !== null && days >= WEIGHT_STALE_DAYS) out.push({ key: `weight_stale:${child.id}`, kind: "weight_stale", subjectId: child.id, tone: "info", badge: `${days}d`, title: `Cân nặng của ${who} đã ${days} ngày chưa cập nhật`, detail: "Bé lớn nhanh — cập nhật để size và ước tính còn đúng.", source: "Từ hồ sơ gia đình", cta: { label: "Cập nhật", href: "/family" }, priority: 30 });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/** What is going fine (spec §3 "Đang ổn"): only claims the data supports. */
export function fineLines(snapshot: FamilySnapshot, policy: FamilyPolicy, attention: Insight[], now = new Date()): string[] {
  const out: string[] = [];
  const { month, goals, estimates } = snapshot;
  const planned = goals.reduce((sum, goal) => sum + (goal.monthlyPlan ?? 0), 0);
  if (month && planned > 0) {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expected = planned * now.getDate() / days;
    if (month.saving >= expected * 0.9) out.push(`Tiết kiệm: đúng tiến độ (${shortVnd(month.saving)} / ${shortVnd(planned)} tháng này)`);
  }
  if (month?.plan && month.transactionCount > 0 && month.paceRatio !== undefined && month.paceRatio <= 1 + policy.spendAlertPct / 100 && !attention.some((item) => item.kind === "money_pace")) out.push(`Chi tiêu: trong nhịp kế hoạch (${shortVnd(month.expense)} / ${shortVnd(month.plan)})`);
  const known = estimates.filter((estimate) => estimate.known);
  if (known.length && !known.some((estimate) => estimate.daysLeft !== null && estimate.daysLeft <= policy.reorderWindowDays)) {
    const soonest = known.find((estimate) => estimate.daysLeft !== null);
    out.push(`Đồ dùng: chưa có món cần mua gấp${soonest ? ` (sớm nhất ${soonest.item.name}, ~${soonest.daysLeft} ngày)` : ""}`);
  }
  if (month && month.upcoming.length > 0 && !month.upcoming.some((item) => item.kind === "expense" && item.daysLeft <= 3)) out.push("Hóa đơn: không có khoản nào đến hạn trong 3 ngày tới");
  return out;
}

/** Home: at most 3 attention cards after feedback, plus "đang ổn" and the starter steps. */
export function buildAttention(snapshot: FamilySnapshot, policy: FamilyPolicy, feedback: InsightFeedback[], now = new Date()): Attention {
  const today = localDay(now);
  const attention = allInsights(snapshot, policy, now).filter((insight) => !silenced(insight.key, feedback, today)).slice(0, MAX_ATTENTION);
  const warn = attention.filter((item) => item.tone === "warn").length;
  const date = `${weekday[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
  return {
    greeting: greetingFor(now, snapshot.displayName ?? snapshot.profile?.familyName),
    subtitle: attention.length ? `${date} · ${warn ? `${warn} việc cần xem sớm` : `${attention.length} điều đáng chú ý`}` : `${date} · Không có gì cần chú ý`,
    attention,
    fine: fineLines(snapshot, policy, attention, now),
    starters: starterSteps(snapshot.profile, snapshot.counts),
  };
}

/** Feedback row for a verdict given today (hide window from HIDE_DAYS). */
export function feedbackFor(key: string, verdict: FeedbackVerdict, now = new Date()): InsightFeedback {
  const days = HIDE_DAYS[verdict];
  return { key, verdict, until: days ? localDay(new Date(now.getTime() + days * DAY_MS)) : undefined };
}
