import { addDays, daysBetween, shortDate } from "./child-stats.ts";
import { MEASURE_EVERY } from "../experience/types.ts";

/**
 * "Nhắc cân đo định kỳ": when each child is due for weighing / measuring. Default cadence by age follows common
 * growth-monitoring practice (WHO/UNICEF, Vietnam MOH growth charts): monthly under 1 year, every 2 months to 3 years,
 * every 6 months after. The family can pick another cadence or turn it off (household.measureEvery).
 * Height only counts once the family has measured it at least once — weight alone never nags about height.
 */
export { MEASURE_EVERY };
export type MeasureEvery = (typeof MEASURE_EVERY)[number];
export const MEASURE_EVERY_LABELS: Record<MeasureEvery, string> = { auto: "Theo tuổi (khuyến nghị)", monthly: "Mỗi tháng", bimonthly: "Mỗi 2 tháng", quarterly: "Mỗi 3 tháng", halfyear: "Mỗi 6 tháng", off: "Tắt nhắc" };
const FIXED: Record<Exclude<MeasureEvery, "auto" | "off">, number> = { monthly: 30, bimonthly: 61, quarterly: 91, halfyear: 182 };
/** "Soon" window: shown ahead, never pushed. */
export const SOON_DAYS = 3;
/** A due child is pushed at most once in this many days. */
export const PUSH_EVERY_DAYS = 7;

export function intervalDays(ageMonths: number | undefined, every: MeasureEvery = "auto"): number | null {
  if (every === "off") return null;
  if (every !== "auto") return FIXED[every];
  if (ageMonths === undefined || ageMonths < 12) return 30;
  return ageMonths < 36 ? 61 : 182;
}
/** "mỗi tháng" / "mỗi 2 tháng" / "mỗi 6 tháng" for a cadence in days. */
export const cadenceText = (days: number) => days <= 31 ? "mỗi tháng" : `mỗi ${Math.round(days / 30.4)} tháng`;

export interface MeasureDue {
  state: "due" | "soon" | "ok";
  /** What to do: weigh, measure height, or both. */
  what: "weight" | "height" | "both";
  nextDate: string;
  /** Days until nextDate; ≤ 0 = due (negative = overdue by that many days). */
  daysLeft: number;
  interval: number;
  lastWeight?: string;
  lastHeight?: string;
}

/** Next measurement for one child; null when reminders are off. Nothing ever measured = due today (weight). */
export function measureDue(input: { ageMonths?: number; lastWeight?: string; lastHeight?: string; today: string; every?: MeasureEvery }): MeasureDue | null {
  const interval = intervalDays(input.ageMonths, input.every);
  if (interval === null) return null;
  const weightNext = input.lastWeight ? addDays(input.lastWeight, interval) : input.today;
  const heightNext = input.lastHeight ? addDays(input.lastHeight, interval) : undefined;
  const nextDate = heightNext && heightNext < weightNext ? heightNext : weightNext;
  const daysLeft = daysBetween(input.today, nextDate);
  // Both are asked for when they fall due within the same few days (one session with the scale and the tape).
  const weightSoon = daysBetween(input.today, weightNext) <= Math.max(daysLeft, 0) + SOON_DAYS;
  const heightSoon = heightNext !== undefined && daysBetween(input.today, heightNext) <= Math.max(daysLeft, 0) + SOON_DAYS;
  const what = weightSoon && heightSoon ? "both" : heightSoon ? "height" : "weight";
  return { state: daysLeft <= 0 ? "due" : daysLeft <= SOON_DAYS ? "soon" : "ok", what, nextDate, daysLeft, interval, lastWeight: input.lastWeight, lastHeight: input.lastHeight };
}

export const WHAT_TEXT: Record<MeasureDue["what"], string> = { weight: "cân", height: "đo chiều cao", both: "cân & đo chiều cao" };

/** One line for the page: "Đến lịch cân & đo chiều cao (trễ 5 ngày)" / "Lần tới: cân 20/10 · còn 21 ngày". */
export function dueLine(due: MeasureDue, today: string): string {
  if (due.state === "due") return `Đến lịch ${WHAT_TEXT[due.what]}${due.daysLeft < 0 ? ` — trễ ${-due.daysLeft} ngày` : " — hôm nay"}`;
  return `Lần tới: ${WHAT_TEXT[due.what]} ${shortDate(due.nextDate, today)} · còn ${due.daysLeft} ngày`;
}

/** Days since the older of the due measurements (for "đã 63 ngày chưa cân"). */
export function sinceLast(due: MeasureDue, today: string): number | undefined {
  const last = due.what === "height" ? due.lastHeight : due.what === "weight" ? due.lastWeight : [due.lastWeight, due.lastHeight].filter(Boolean).sort()[0];
  return last ? daysBetween(last, today) : undefined;
}

export interface MeasurePush { childId: string; title: string; body: string; url: string; tag: string }
/** Push for a due child unless one went out in the last PUSH_EVERY_DAYS days (`lastPushed` = YYYY-MM-DD). */
export function measurePush(childId: string, name: string, due: MeasureDue | null, today: string, lastPushed?: string): MeasurePush | null {
  if (!due || due.state !== "due" || (lastPushed && daysBetween(lastPushed, today) < PUSH_EVERY_DAYS)) return null;
  const since = sinceLast(due, today);
  return {
    childId,
    title: `Đến lịch ${WHAT_TEXT[due.what]} cho ${name}`,
    body: `${since !== undefined ? `Lần trước cách đây ${since} ngày. ` : ""}Ở tuổi này nên cân đo ${cadenceText(due.interval)} — ghi lại để xem ${name} so với chuẩn WHO.`,
    url: "/family#fam-kids",
    tag: `measure-${childId}`,
  };
}
