import type { FamilyProfile } from "../experience/types.ts";
import { shortVnd, type MonthSummary } from "../money/summary.ts";
import { travelHomeCard } from "../travel/home-card.ts";
import type { TravelState } from "../travel/types.ts";

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
  displayName?: string;
  /** Current-month money summary when the ledger is available (null = not loaded / not signed in). */
  money?: MonthSummary | null;
  /** Trips, packing and expenses for the travel card (null = not loaded; no upcoming trip = no card). */
  travel?: TravelState | null;
  now?: Date;
}

const weekday = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function greetingFor(now: Date, name?: string): string {
  const hour = now.getHours();
  const part = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  return name ? `${part}, ${name}` : part;
}

/** Vietnam calendar day of a time (the family's day, whatever the device timezone). */
const vnDay = (time: number) => new Date(time + 7 * 3_600_000).toISOString().slice(0, 10);

export function buildBrief({ profile, displayName, money = null, travel = null, now = new Date() }: BriefInput): FamilyBrief {
  const attention: BriefCard[] = [];
  const insights: BriefInsight[] = [];

  if (profile && !profile.aiConsent) attention.push({ id: "ai-off", tone: "info", badge: "AI", title: "AI đang tắt — FamAgent chỉ dùng quy tắc", detail: "Bật AI để tự xếp nhóm khoản chi và đọc ảnh hoá đơn. Tên bé được thay bằng mã trước khi gửi.", cta: { label: "Bật AI", href: "/family#account" } });

  // Money (SPEC_V2 §16): pace vs plan, bills due soon, or the nudge to start the ledger.
  if (money && money.transactionCount > 0) {
    if (money.plan && money.paceRatio !== undefined && money.paceRatio > 1.05) attention.push({ id: "money-pace", tone: "warn", badge: `+${Math.round((money.paceRatio - 1) * 100)}%`, title: `Chi tiêu tháng này cao hơn kế hoạch ${Math.round((money.paceRatio - 1) * 100)}%`, detail: money.insights.find((item) => item.id === "over-pace")?.text ?? `Dự kiến chi ${shortVnd(money.expectedExpense!)} so với kế hoạch ${shortVnd(money.plan)}.`, cta: { label: "Xem vì sao", href: "/money#month" } });
    for (const item of money.upcoming.slice(0, 2)) attention.push({ id: `due-${item.id}`, tone: item.daysLeft <= 2 ? "warn" : "ok", badge: item.daysLeft === 0 ? "Nay" : `${item.daysLeft}d`, title: `${item.name} ${shortVnd(item.amount)} ${item.daysLeft === 0 ? "đến hạn hôm nay" : `đến hạn sau ${item.daysLeft} ngày`}`, detail: `Khoản định kỳ · ${item.kind === "income" ? "sẽ tự ghi là thu" : "sẽ tự ghi vào sổ khi tới ngày"}.`, cta: { label: "Xem sổ", href: "/money" } });
    for (const insight of money.insights.filter((item) => item.id !== "over-pace").slice(0, 1)) insights.unshift({ text: insight.text, source: insight.source, href: "/money" });
  } else {
    attention.push({ id: "money-setup", tone: "ok", badge: "₫", title: "Bắt đầu sổ thu chi của gia đình", detail: "Ghi vài khoản đầu tiên để Trang chủ hiện tiền tháng này và khoản sắp đến hạn.", cta: { label: "Mở Tài chính", href: "/money" } });
  }

  // Travel (plan 261010-1335 §4.8): one card for the nearest trip; urgent (≤7 days out) goes first.
  const tripCard = travelHomeCard(travel, vnDay(now.getTime()));
  if (tripCard) {
    const card: BriefCard = { id: "travel-trip", tone: tripCard.tone, badge: tripCard.badge, title: tripCard.title, detail: tripCard.detail, cta: tripCard.cta };
    if (tripCard.urgent) attention.unshift(card); else attention.push(card);
  }

  const count = attention.filter((card) => card.tone === "warn").length;
  const date = `${weekday[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
  return {
    greeting: greetingFor(now, displayName ?? profile?.familyName),
    subtitle: count ? `${date} · ${count} việc cần bạn xem` : `${date} · Không có gì gấp hôm nay`,
    attention,
    insights: insights.slice(0, 3),
  };
}
