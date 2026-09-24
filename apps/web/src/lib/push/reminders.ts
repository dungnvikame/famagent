// "Sắp hết" push reminders (phase 4): which items to remind about today. Pure; the cron route loads data and sends.
import type { ItemEstimate } from "../shopping/items.ts";

export const PUSH_WINDOW_DAYS = 3;
/** An item estimated as out is reminded at most this many times in two weeks (then the family has seen it). */
export const MAX_OUT_REMINDERS = 3;
export interface Reminder { itemId: string; title: string; body: string; url: string; tag: string }

/**
 * Known items at ≤3 days left, not reminded today, soonest first, at most `limit` per family per day.
 * `recent` counts reminders per item in the last 14 days, so an item left at "hết" is not pushed every day forever.
 */
export function remindersFor(estimates: ItemEstimate[], sentToday: ReadonlySet<string>, limit = 2, recent: ReadonlyMap<string, number> = new Map()): Reminder[] {
  return estimates.filter((estimate) => estimate.known && estimate.daysLeft !== null && estimate.daysLeft <= PUSH_WINDOW_DAYS && !sentToday.has(estimate.item.id)
      && !(estimate.daysLeft === 0 && (recent.get(estimate.item.id) ?? 0) >= MAX_OUT_REMINDERS))
    .slice(0, limit)
    .map((estimate) => ({
      itemId: estimate.item.id,
      title: estimate.daysLeft === 0 ? `${estimate.item.name} có thể đã hết` : `${estimate.item.name} còn khoảng ${estimate.daysLeft} ngày`,
      body: `${estimate.lastPackPrice ? `Lần trước ${Math.round(estimate.lastPackPrice / 1000)}K/gói${estimate.item.merchant ? ` ở ${estimate.item.merchant}` : ""}. ` : ""}Mở FamAgent để ghi “Đã mua” hoặc báo “còn nhiều”.`,
      url: "/shopping",
      tag: `low-${estimate.item.id}`,
    }));
}
