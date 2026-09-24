// Unusual spending (core journey spec §7): a ledger category's last 7 days against its average week over the 4 weeks
// before — "Chi ăn ngoài tuần này cao hơn trung bình 32%". Needs at least 2 earlier weeks with spend in the category.
import type { MoneyTransaction } from "../money/types.ts";

export interface CategorySpike { category: string; week7: number; average: number; pct: number; /** YYYY-MM-DD the window ends (dedupe key). */ week: string }

const DAY_MS = 86_400_000;
const localDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
/** Ignore small absolute changes (a 50K coffee week is not news). */
export const MIN_SPIKE_VND = 200_000;
/** Categories that are bills or transfers, not behaviour. */
const IGNORED = new Set(["Tiền trả góp", "Tiền thẻ tín dụng", "Tiền trả nợ", "Tiền cho vay", "Chi phí đầu tư", "Tiền điện", "Tiền nước"]);

export function categorySpikes(transactions: MoneyTransaction[], now: Date, thresholdPct: number): CategorySpike[] {
  const end = localDay(now);
  const weekStart = localDay(new Date(now.getTime() - 6 * DAY_MS));
  const historyStart = localDay(new Date(now.getTime() - 34 * DAY_MS));
  const byCategory = new Map<string, { current: number; weeks: number[] }>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || tx.occurredOn > end || tx.occurredOn < historyStart || IGNORED.has(tx.category)) continue;
    const entry = byCategory.get(tx.category) ?? { current: 0, weeks: [0, 0, 0, 0] };
    if (tx.occurredOn >= weekStart) entry.current += tx.amount;
    else {
      const daysBefore = Math.floor((new Date(`${weekStart}T00:00:00`).getTime() - new Date(`${tx.occurredOn}T00:00:00`).getTime()) / DAY_MS);
      const week = Math.min(3, Math.floor((daysBefore - 1) / 7));
      if (week >= 0) entry.weeks[week] += tx.amount;
    }
    byCategory.set(tx.category, entry);
  }
  const out: CategorySpike[] = [];
  for (const [category, { current, weeks }] of byCategory) {
    if (weeks.filter((amount) => amount > 0).length < 2) continue;
    const average = weeks.reduce((sum, amount) => sum + amount, 0) / 4;
    const pct = average ? Math.round((current / average - 1) * 100) : 0;
    if (pct >= thresholdPct && current - average >= MIN_SPIKE_VND) out.push({ category, week7: current, average: Math.round(average), pct, week: end });
  }
  return out.sort((a, b) => (b.week7 - b.average) - (a.week7 - a.average));
}
