import type { Conversation, FamilyProfile } from "../experience/types.ts";
import { childAgeMonths } from "../experience/profile-mapper.ts";
import { formatWeight } from "../onboarding/questions.ts";
import { shortVnd, type MonthSummary } from "../money/summary.ts";
import { runningLow, type ItemEstimate } from "../shopping/items.ts";

/**
 * Family Brief (spec v2 §16–17): what needs attention, built from data the app already has.
 * Pure function so the rules are unit-tested; money/consumption cards arrive with the Finance
 * and cross-module phases and plug into the same shape.
 */
export interface BriefCard {
  id: string;
  tone: "warn" | "ok" | "info";
  /** Short badge text (≤4 chars), e.g. "!" or "3". */
  badge: string;
  title: string;
  detail: string;
  cta: { label: string; href: string };
}

export interface BriefInsight { text: string; source: string; href?: string }

export interface FamilyBrief {
  greeting: string;
  subtitle: string;
  attention: BriefCard[];
  insights: BriefInsight[];
}

export interface BriefInput {
  profile: FamilyProfile | null;
  conversations: Conversation[];
  savedCount: number;
  displayName?: string;
  /** Current-month money summary when the ledger is available (null = not loaded / not signed in). */
  money?: MonthSummary | null;
  /** Stock estimates per household item (Shopping side of the event stream). */
  stock?: ItemEstimate[];
  now?: Date;
}

/** Diaper size guidance by weight (kg), matching the ranges used by the onboarding weight choices. */
export function diaperSizeFor(weightKg: number): string {
  if (weightKg < 5) return "NB/S";
  if (weightKg < 8) return "M";
  if (weightKg < 12) return "L";
  if (weightKg < 15) return "XL";
  return "XXL";
}

const DAY_MS = 86_400_000;
const WEIGHT_STALE_DAYS = 60;
const weekday = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function greetingFor(now: Date, name?: string): string {
  const hour = now.getHours();
  const part = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  return name ? `${part}, ${name}` : part;
}

export function buildBrief({ profile, conversations, savedCount, displayName, money = null, stock = [], now = new Date() }: BriefInput): FamilyBrief {
  const attention: BriefCard[] = [];
  const insights: BriefInsight[] = [];
  const children = profile?.children ?? [];

  // The magic moment (spec v2 §40): running low is known before anyone remembers to check.
  for (const estimate of runningLow(stock).slice(0, 2)) {
    const { item, daysLeft, lastPurchase } = estimate;
    const days = daysLeft ?? 0;
    const source = estimate.rateSource === "learned" ? " theo nhịp dùng của nhà mình" : estimate.rateSource === "default" ? " (ước tính)" : "";
    attention.push({ id: `low-${item.id}`, tone: days <= 3 ? "warn" : "info", badge: days === 0 ? "Hết" : `${days}d`, title: days === 0 ? `${item.name} ước tính đã hết` : `${item.name} còn khoảng ${days} ngày`, detail: `Từ ${estimate.purchaseCount} lần mua${lastPurchase ? ` (gần nhất ${lastPurchase.purchasedOn.slice(8)}/${lastPurchase.purchasedOn.slice(5, 7)})` : ""}, ${Math.round(estimate.dailyRate * 10) / 10} ${item.unit}/ngày${source}.`, cta: { label: "Mua lại", href: item.productId ? `/agent?q=${encodeURIComponent(`Mua lại ${item.name}`)}` : "/shopping" } });
  }

  for (const child of children) {
    const who = child.name ? `bé ${child.name}` : "bé";
    if (child.weightKg === undefined) {
      attention.push({ id: `weight-${child.id}`, tone: "warn", badge: "?", title: `Chưa có cân nặng của ${who}`, detail: "Cân nặng quyết định size bỉm — thiếu thì FamAgent chỉ gợi ý được chung chung.", cta: { label: "Bổ sung", href: "/family" } });
      continue;
    }
    const observed = profile?.fieldMeta?.[`children.${child.id}.weightKg`]?.observedAt;
    const ageDays = observed ? Math.floor((now.getTime() - new Date(observed).getTime()) / DAY_MS) : null;
    if (ageDays !== null && ageDays >= WEIGHT_STALE_DAYS) {
      attention.push({ id: `stale-${child.id}`, tone: "info", badge: `${ageDays}d`, title: `Cân nặng của ${who} đã ${ageDays} ngày chưa cập nhật`, detail: `Đang dùng ${formatWeight(child.weightKg)}. Bé lớn nhanh — kiểm tra lại để không mua sai size.`, cta: { label: "Cập nhật", href: "/family" } });
    }
    const size = diaperSizeFor(child.weightKg);
    const months = childAgeMonths(child, now);
    if (child.diaperSize && !size.split("/").includes(child.diaperSize)) {
      insights.push({ text: `${who[0].toUpperCase()}${who.slice(1)} ${formatWeight(child.weightKg)} thường hợp size ${size}, hồ sơ đang ghi size ${child.diaperSize}. Nếu bé hay tràn, thử lên size.`, source: "Từ cân nặng và size trong hồ sơ", href: "/family" });
    } else {
      insights.push({ text: `${who[0].toUpperCase()}${who.slice(1)}${months !== undefined ? ` ${months} tháng` : ""} · ${formatWeight(child.weightKg)} → size ${size} phù hợp${profile?.maxBudget ? `, trong ngân sách ${profile.maxBudget.toLocaleString("vi-VN")}đ` : ""}.`, source: "Từ hồ sơ gia đình", href: "/agent" });
    }
  }

  // An unanswered clarification from the agent is the most actionable thing on the list.
  const pending = conversations.find((item) => { const last = item.turns.at(-1); return last?.role === "assistant" && (last.choices?.length ?? 0) > 0; });
  if (pending) attention.push({ id: `pending-${pending.id}`, tone: "warn", badge: "!", title: "FamAgent đang chờ bạn trả lời", detail: `“${pending.title}” — chọn một gợi ý để tiếp tục.`, cta: { label: "Trả lời", href: `/agent?c=${pending.id}` } });

  if (profile && !profile.aiConsent) attention.push({ id: "ai-off", tone: "info", badge: "AI", title: "AI đang tắt — FamAgent chỉ dùng quy tắc", detail: "Bật AI để hiểu câu hỏi tự nhiên hơn. Tên bé được thay bằng mã trước khi gửi.", cta: { label: "Bật AI", href: "/family#account" } });

  // Money (SPEC_V2 §16): pace vs plan, bills due soon, or the nudge to start the ledger.
  if (money && money.transactionCount > 0) {
    if (money.plan && money.paceRatio !== undefined && money.paceRatio > 1.05) attention.push({ id: "money-pace", tone: "warn", badge: `+${Math.round((money.paceRatio - 1) * 100)}%`, title: `Chi tiêu tháng này cao hơn kế hoạch ${Math.round((money.paceRatio - 1) * 100)}%`, detail: money.insights.find((item) => item.id === "over-pace")?.text ?? `Dự kiến chi ${shortVnd(money.expectedExpense!)} so với kế hoạch ${shortVnd(money.plan)}.`, cta: { label: "Xem vì sao", href: "/money#month" } });
    for (const item of money.upcoming.slice(0, 2)) attention.push({ id: `due-${item.id}`, tone: item.daysLeft <= 2 ? "warn" : "ok", badge: item.daysLeft === 0 ? "Nay" : `${item.daysLeft}d`, title: `${item.name} ${shortVnd(item.amount)} ${item.daysLeft === 0 ? "đến hạn hôm nay" : `đến hạn sau ${item.daysLeft} ngày`}`, detail: `Khoản định kỳ · ${item.kind === "income" ? "sẽ tự ghi là thu" : "sẽ tự ghi vào sổ khi tới ngày"}.`, cta: { label: "Xem sổ", href: "/money" } });
    for (const insight of money.insights.filter((item) => item.id !== "over-pace").slice(0, 1)) insights.unshift({ text: insight.text, source: insight.source, href: "/money" });
  } else {
    attention.push({ id: "money-setup", tone: "ok", badge: "₫", title: "Bắt đầu sổ thu chi của gia đình", detail: "Ghi vài khoản đầu tiên để Trang chủ hiện tiền tháng này và khoản sắp đến hạn.", cta: { label: "Mở Tài chính", href: "/money" } });
  }

  if (savedCount > 0) insights.push({ text: `Bạn đang lưu ${savedCount} sản phẩm để xem lại. Hỏi FamAgent “so sánh các sản phẩm đã lưu” để thấy khác biệt theo giá mỗi miếng.`, source: "Từ danh sách đã lưu", href: "/shopping?tab=saved" });

  const count = attention.filter((card) => card.tone === "warn").length;
  const date = `${weekday[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
  return {
    greeting: greetingFor(now, displayName ?? profile?.familyName),
    subtitle: count ? `${date} · ${count} việc cần bạn xem` : `${date} · Không có gì gấp hôm nay`,
    attention,
    insights: insights.slice(0, 3),
  };
}
