import { normalize } from "./quick-add.ts";
import type { MoneyKind, MoneyRecurring, RecurringPeriod, RecurringSchedule } from "./types.ts";

/**
 * Fixed items (rent, salary, electricity, tuition…): when a period is due, what it is expected to cost, and which
 * ledger entry answers it. Nothing here writes; the family confirms a due period ("Đã trả?") or skips it.
 * Pure, so every rule is unit-tested.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const isoDate = (month: string, day: number) => `${month}-${pad(day)}`;
const monthOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return monthOf(new Date(y, m - 1 + delta, 1)); };
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayIndex = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 86_400_000); };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const QUARTER_MONTHS = [1, 4, 7, 10];
/** A period starts asking this many days before its window opens ("Đã trả?" shows up the day before, not a week early). */
export const ASK_DAYS_BEFORE = 3;

export const scheduleOf = (item: Pick<MoneyRecurring, "schedule">): RecurringSchedule => item.schedule ?? { kind: "month" };
/** Monthly cadence = comes every month (rent, electricity, salary); quarter/year items come in some months only. */
export const isMonthly = (item: Pick<MoneyRecurring, "schedule">) => ["month", "range", "eom"].includes(scheduleOf(item).kind);

/** Does the item come due in that month at all? */
export function appliesInMonth(item: Pick<MoneyRecurring, "schedule">, month: string): boolean {
  const schedule = scheduleOf(item); const m = Number(month.slice(5));
  return schedule.kind === "quarter" ? QUARTER_MONTHS.includes(m) : schedule.kind === "year" ? schedule.month === m : true;
}

/** First and last day of the due window inside the month (clamped to its length), or null when it does not come that month. */
export function windowIn(item: Pick<MoneyRecurring, "schedule" | "dayOfMonth">, month: string): { from: number; to: number } | null {
  if (!appliesInMonth(item, month)) return null;
  const days = daysIn(month); const schedule = scheduleOf(item);
  if (schedule.kind === "eom") return { from: days, to: days };
  const from = clamp(item.dayOfMonth, 1, days);
  const to = "to" in schedule && schedule.to ? clamp(schedule.to, from, days) : from;
  return { from, to };
}

/** "5–12", "ngày 30", "cuối tháng" — the window as the family reads it. */
export function windowLabel(item: Pick<MoneyRecurring, "schedule" | "dayOfMonth">, month: string): string {
  const w = windowIn(item, month);
  if (!w) return "";
  if (scheduleOf(item).kind === "eom") return "cuối tháng";
  return w.from === w.to ? `ngày ${w.from}` : `${w.from}–${w.to}`;
}

/** Usual amount: the average of the last (up to 3) paid amounts for "ước lượng" items that have any, else the set amount. */
export function expectedAmount(item: Pick<MoneyRecurring, "id" | "amount" | "amountMode">, amounts?: Record<string, number[]>): { amount: number; estimated: boolean } {
  const history = amounts?.[item.id]?.slice(0, 3) ?? [];
  if (item.amountMode === "estimate") return { amount: history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : item.amount, estimated: true };
  return { amount: item.amount, estimated: false };
}

export interface DueEntry {
  recurringId: string;
  name: string;
  kind: MoneyKind;
  category: string;
  /** YYYY-MM of the period. */
  period: string;
  /** Window as YYYY-MM-DD. */
  from: string;
  to: string;
  label: string;
  /** Days from today to the window start (negative once it has opened). */
  daysToStart: number;
  /** "soon" = later this week, "due" = asking now, "overdue" = the window has passed and nobody answered. */
  state: "soon" | "due" | "overdue";
  amount: number;
  estimated: boolean;
}

const answered = (periods: RecurringPeriod[], id: string, period: string) => periods.some((p) => p.recurringId === id && p.period === period);

/**
 * Periods waiting for an answer, most urgent first. A period is settled by a paid/skipped record or by any period at
 * or before the item's `lastPostedMonth`; an item that was never settled starts asking with the current month, and
 * missed periods are only chased for `lookbackMonths` months. Monthly items never ask about next month yet.
 */
export function dueEntries(recurring: MoneyRecurring[], periods: RecurringPeriod[], amounts: Record<string, number[]> | undefined, now: Date, opts: { horizonDays?: number; lookbackMonths?: number } = {}): DueEntry[] {
  const horizon = opts.horizonDays ?? 7; const lookback = opts.lookbackMonths ?? 3;
  const today = dayStart(now); const todayIndex = dayIndex(`${monthOf(today)}-${pad(today.getDate())}`); const current = monthOf(today);
  const out: DueEntry[] = [];
  for (const item of recurring) {
    if (!item.active) continue;
    for (let offset = -lookback; offset <= 1; offset += 1) {
      const period = shiftMonth(current, offset);
      if (item.lastPostedMonth ? period <= item.lastPostedMonth : period < current) continue;
      // Next month's rent or salary is asked once that month starts; only quarter/year items (a lump) warn ahead.
      if (offset === 1 && isMonthly(item)) continue;
      const window = windowIn(item, period);
      if (!window || answered(periods, item.id, period)) continue;
      const from = isoDate(period, window.from); const to = isoDate(period, window.to);
      const daysToStart = dayIndex(from) - todayIndex;
      const state: DueEntry["state"] | null = todayIndex > dayIndex(to) ? "overdue" : offset < 1 && daysToStart <= ASK_DAYS_BEFORE ? "due" : daysToStart <= horizon ? "soon" : null;
      if (!state) continue;
      const { amount, estimated } = expectedAmount(item, amounts);
      out.push({ recurringId: item.id, name: item.name, kind: item.kind, category: item.category, period, from, to, label: windowLabel(item, period), daysToStart, state, amount, estimated });
    }
  }
  const rank = { overdue: 0, due: 1, soon: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.from.localeCompare(b.from));
}

/**
 * Expenses of `month` that are still to be paid: periods with no answer (even if their window has not opened),
 * at their expected amount. This is what "Còn tiêu được" and the month-end forecast hold back.
 */
export function fixedStillDue(recurring: MoneyRecurring[], periods: RecurringPeriod[], amounts: Record<string, number[]> | undefined, month: string): number {
  let total = 0;
  for (const item of recurring) {
    if (!item.active || item.kind !== "expense" || !windowIn(item, month) || answered(periods, item.id, month)) continue;
    if (item.lastPostedMonth && month <= item.lastPostedMonth) continue;
    total += expectedAmount(item, amounts).amount;
  }
  return total;
}

/** Answered periods found in the ledger: an entry carrying a recurring id answers the month it is dated in (oldest data included). */
export function periodsFromEntries(entries: Array<{ recurringId?: string; occurredOn: string; amount: number }>): RecurringPeriod[] {
  const seen = new Map<string, RecurringPeriod>();
  for (const entry of entries) {
    if (!entry.recurringId) continue;
    const period = entry.occurredOn.slice(0, 7); const key = `${entry.recurringId}|${period}`;
    if (!seen.has(key)) seen.set(key, { recurringId: entry.recurringId, period, status: "paid", paidOn: entry.occurredOn, amount: Math.abs(entry.amount) });
  }
  return [...seen.values()];
}

/** Records first (they can say "skipped"), then whatever the ledger adds for periods without a record. */
export function mergePeriods(records: RecurringPeriod[], fromEntries: RecurringPeriod[]): RecurringPeriod[] {
  const out = [...records];
  for (const period of fromEntries) if (!answered(out, period.recurringId, period.period)) out.push(period);
  return out;
}

/** Last (up to 3) amounts per fixed item from its ledger entries, newest first. */
export function recurringAmountsFrom(entries: Array<{ recurringId?: string; occurredOn: string; amount: number }>): Record<string, number[]> {
  const byItem = new Map<string, Array<{ on: string; amount: number }>>();
  for (const entry of entries) { if (!entry.recurringId) continue; const list = byItem.get(entry.recurringId) ?? []; list.push({ on: entry.occurredOn, amount: Math.abs(entry.amount) }); byItem.set(entry.recurringId, list); }
  const out: Record<string, number[]> = {};
  for (const [id, list] of byItem) out[id] = list.sort((a, b) => b.on.localeCompare(a.on)).slice(0, 3).map((row) => row.amount);
  return out;
}

const STOP = new Set(["tien", "phi", "cua", "va", "cho", "thang", "quy", "nam"]);
const tokens = (text: string) => normalize(text).split(" ").filter((word) => word.length >= 2 && !/\d/.test(word) && !STOP.has(word));

/**
 * The waiting period a typed entry answers: every meaningful word of the item's name appears in what was typed
 * ("trả góp xe 4,5tr" → Trả góp xe). Failing that, the only waiting item of the same kind and category whose
 * amount is within 35% of the typed one. Urgent periods win over early ones.
 */
export function matchDue(entries: DueEntry[], typed: { content: string; kind: MoneyKind; category?: string; amount?: number }): DueEntry | null {
  const words = new Set(tokens(typed.content));
  const sameKind = entries.filter((entry) => entry.kind === typed.kind);
  const byName = sameKind.filter((entry) => { const need = tokens(entry.name); return need.length > 0 && need.every((word) => words.has(word)); });
  if (byName.length) return byName[0];
  if (typed.category && typed.amount) {
    const close = sameKind.filter((entry) => entry.category === typed.category && Math.abs(entry.amount - typed.amount!) <= entry.amount * 0.35);
    if (close.length === 1) return close[0];
  }
  return null;
}
