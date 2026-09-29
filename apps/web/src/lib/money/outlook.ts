import { categoryAverages } from "./history.ts";
import { vndCompact } from "./format-vnd.ts";
import { cashflow, effectivePlan, flexibleCategories, type CashflowMonth } from "./plan.ts";
import { daysInMonth, monthKey, type MonthSummary } from "./summary.ts";
import type { MoneyBundle } from "./types.ts";
import { vnd } from "../catalog/format.ts";

/**
 * "Tương lai & nên làm gì": the next three months from the fixed items and the plan, plus up to three rule-based
 * suggestions read from the same numbers. Pure arithmetic, no LLM; every tip names its numbers and only navigates.
 */
export interface TipAction { label: string; target: "plan" | "ledger" | "debt"; category?: string }
export interface Tip { id: string; tone: "warn" | "info" | "ok"; title: string; detail: string; action?: TipAction }

const OUTLOOK_MONTHS = 3;
/** A category is "running high" when its month-end pace is over this multiple of its 3-month average… */
const HIGH_PACE = 1.3;
/** …and it has already cost at least this much (a few small purchases early on say nothing). */
const MIN_SPENT = 300_000;
/** Pace before this day of the month is too noisy to call. */
const MIN_ELAPSED_DAYS = 5;
const EMERGENCY_MONTHS = 3;

const shift = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const monthNo = (month: string) => Number(month.slice(5));
const months1 = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** The months shown: the three after the current one (or after the bundle's month when that is later). */
export function outlookMonths(bundle: Pick<MoneyBundle, "month">, now: Date): string[] {
  const base = bundle.month > monthKey(now) ? bundle.month : monthKey(now);
  return Array.from({ length: OUTLOOK_MONTHS }, (_, i) => shift(base, i + 1));
}

/** The 3-month table needs fixed items and a plan (typed or income − saving); without them it would only show zeros. */
export function hasOutlook(bundle: Pick<MoneyBundle, "recurring" | "settings" | "month">, now: Date): boolean {
  const [next] = outlookMonths(bundle, now);
  return bundle.recurring.some((item) => item.active) && effectivePlan(bundle.settings, bundle.recurring, next) !== undefined;
}

function shortfallTip(months: CashflowMonth[], savings: number): Tip | undefined {
  const bad = months.find((row) => row.income > 0 && row.left < 0);
  if (!bad) return undefined;
  const lump = [...bad.lumps].sort((a, b) => b.amount - a.amount)[0];
  const gap = -bad.left;
  const cause = lump ? `vì ${lump.name} (${vndCompact(lump.amount)})` : "vì chi và tiết kiệm dự kiến cao hơn thu";
  const fund = savings > 0 ? `Quỹ tiết kiệm hiện có ${vndCompact(savings)}${savings >= gap ? " — đủ bù nếu lấy từ quỹ." : " — chưa đủ bù khoản thiếu."}` : "Quỹ tiết kiệm hiện chưa có tiền để bù.";
  return { id: "shortfall", tone: "warn", title: `Tháng ${monthNo(bad.month)} dự kiến thiếu ${vndCompact(gap)} ${cause}`, detail: `${fund} Xem lại khoản cố định hoặc mức tiết kiệm hằng tháng.`, action: { label: "Xem khoản cố định", target: "plan" } };
}

function paceTip(bundle: MoneyBundle, summary: MonthSummary, now: Date): Tip | undefined {
  if (summary.month !== monthKey(now)) return undefined;
  const elapsed = Math.max(1, now.getDate());
  if (elapsed < MIN_ELAPSED_DAYS) return undefined;
  const days = daysInMonth(summary.month);
  const averages = categoryAverages(bundle.history ?? [], summary.month);
  // Only day-to-day spending: a fixed item's category or a loan payment comes once, so its pace says nothing.
  const flexible = new Set(flexibleCategories(bundle.settings.categories, bundle.recurring));
  const high = summary.byCategory
    .filter((line) => flexible.has(line.category) && line.spent >= MIN_SPENT && (averages[line.category] ?? 0) > 0)
    .map((line) => ({ line, average: averages[line.category], projected: line.spent / elapsed * days }))
    .filter((row) => row.projected > HIGH_PACE * row.average)
    .sort((a, b) => b.projected / b.average - a.projected / a.average)[0];
  if (!high) return undefined;
  const { line, average, projected } = high;
  const pct = Math.round((projected / average - 1) * 100);
  return { id: `pace-${line.category}`, tone: "warn", title: `${line.category} đang chi cao hơn trung bình 3 tháng ${pct}%`, detail: `Đã chi ${vnd(line.spent)} trong ${elapsed} ngày đầu; với nhịp này cuối tháng ~${vndCompact(projected)}, trung bình 3 tháng là ${vndCompact(average)}${line.limit ? `, ngân sách ${vndCompact(line.limit)}` : ""}.`, action: { label: "Xem khoản chi", target: "ledger", category: line.category } };
}

function reserveTip(bundle: MoneyBundle, summary: MonthSummary): Tip | undefined {
  const earlier = (bundle.history ?? []).filter((row) => row.month < summary.month && row.expense > 0).slice(-3);
  if (!earlier.length) return undefined;
  const average = earlier.reduce((sum, row) => sum + row.expense, 0) / earlier.length;
  const savings = Math.max(0, summary.balances.savings);
  const covered = savings / average;
  if (covered >= EMERGENCY_MONTHS) return undefined;
  return { id: "reserve", tone: covered < 1 ? "warn" : "info", title: `Quỹ dự phòng mới đủ ${months1(covered)} tháng chi tiêu`, detail: `Quỹ tiết kiệm ${vndCompact(savings)}, chi tiêu trung bình ${vndCompact(average)} mỗi tháng. Nên có ít nhất ${EMERGENCY_MONTHS} tháng (khoảng ${vndCompact(average * EMERGENCY_MONTHS)}).`, action: { label: "Mở kế hoạch", target: "plan" } };
}

export function outlook(bundle: MoneyBundle, summary: MonthSummary, now: Date): { months: CashflowMonth[]; tips: Tip[] } {
  const months = cashflow(bundle.recurring, bundle.settings, outlookMonths(bundle, now), bundle.recurringAmounts);
  const tips = [shortfallTip(months, summary.balances.savings), paceTip(bundle, summary, now), reserveTip(bundle, summary)].filter((tip): tip is Tip => tip !== undefined);
  return { months, tips: tips.slice(0, 3) };
}
