// Pure trip arithmetic: dates, countdown, derived phase, readiness and budget totals. No I/O — the pages,
// the reminder cron and the tests all share it, so imports stay relative with .ts extensions.
import { DEFAULT_BUDGET_SPLIT, EXPENSE_BUCKETS, type ExpenseBucket, type ItineraryEntry, type PackingItem, type Trip, type TripExpense } from "./types.ts";

const DAY_MS = 86_400_000;
const atMidnight = (day: string) => new Date(`${day}T00:00:00`);
export const toDay = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Whole days from `today` to the trip start (0 = departure day, negative = already started). */
export function countdownDays(trip: Pick<Trip, "startDate">, today: string): number {
  return Math.round((atMidnight(trip.startDate).getTime() - atMidnight(today).getTime()) / DAY_MS);
}

/** Every date of the trip, departure to return inclusive (end < start never happens — the DB checks it). */
export function tripDays(trip: Pick<Trip, "startDate" | "endDate">): string[] {
  const days: string[] = [];
  for (let at = atMidnight(trip.startDate).getTime(); at <= atMidnight(trip.endDate).getTime() && days.length < 60; at += DAY_MS) days.push(toDay(new Date(at)));
  return days;
}

export const tripNights = (trip: Pick<Trip, "startDate" | "endDate">): number => Math.max(0, tripDays(trip).length - 1);

/** The phase the dates imply; an explicit done/cancelled set by the family always wins. */
export function tripPhase(trip: Pick<Trip, "startDate" | "endDate" | "status">, today: string): Trip["status"] {
  if (trip.status === "done" || trip.status === "cancelled") return trip.status;
  if (today > trip.endDate) return "done";
  return today >= trip.startDate ? "ongoing" : "planning";
}

/** "Đà Nẵng hè 2027" — destination + season of the departure month. */
export function suggestTripName(destination: string, startDate: string): string {
  const month = Number(startDate.slice(5, 7));
  const season = month >= 4 && month <= 8 ? "hè" : month >= 9 && month <= 11 ? "cuối năm" : "đầu năm";
  const year = startDate.slice(0, 4);
  return `${destination.trim()} ${season} ${year}`.trim();
}

/** VND budget per bucket from the percent split (missing/empty split = the default frame). */
export function bucketBudgets(trip: Pick<Trip, "budgetAmount" | "budgetSplit">): Record<ExpenseBucket, number> {
  const split = trip.budgetSplit && Object.keys(trip.budgetSplit).length ? trip.budgetSplit : DEFAULT_BUDGET_SPLIT;
  const out = {} as Record<ExpenseBucket, number>;
  for (const bucket of EXPENSE_BUCKETS) out[bucket] = Math.round((trip.budgetAmount * (split[bucket] ?? 0)) / 100);
  return out;
}

export function spentByBucket(expenses: TripExpense[]): Record<ExpenseBucket, number> {
  const out = { transport: 0, lodging: 0, food: 0, activity: 0, misc: 0 } as Record<ExpenseBucket, number>;
  for (const expense of expenses) out[expense.bucket] += expense.amount;
  return out;
}

export const spentTotal = (expenses: TripExpense[]): number => expenses.reduce((sum, expense) => sum + expense.amount, 0);

/** Planned-but-unspent itinerary costs ("sắp chi"). */
export const plannedTotal = (entries: ItineraryEntry[]): number => entries.reduce((sum, entry) => sum + (entry.estAmount || 0), 0);

export interface TripReadiness {
  /** Days of the trip that have at least one itinerary entry. */
  daysPlanned: number;
  daysTotal: number;
  packed: number;
  /** Items still to pack (todo only — "mua tại chỗ" is settled). */
  packLeft: number;
  packTotal: number;
  spent: number;
  /** 0–100, capped (overspend stays 100 for the bar; the pill tells the story). */
  budgetPct: number;
}

export function tripReadiness(trip: Trip, itinerary: ItineraryEntry[], packing: PackingItem[], expenses: TripExpense[]): TripReadiness {
  const days = tripDays(trip);
  const planned = new Set(itinerary.filter((entry) => entry.dayDate).map((entry) => entry.dayDate));
  const packed = packing.filter((item) => item.status === "packed").length;
  const spent = spentTotal(expenses);
  return {
    daysPlanned: days.filter((day) => planned.has(day)).length,
    daysTotal: days.length,
    packed,
    packLeft: packing.filter((item) => item.status === "todo").length,
    packTotal: packing.length,
    spent,
    budgetPct: trip.budgetAmount > 0 ? Math.min(100, Math.round((spent / trip.budgetAmount) * 100)) : 0,
  };
}

/** The one next action the trip card points at, in priority order. */
export function nextAction(readiness: TripReadiness, countdown: number): { tab: "packing" | "itin" | "money" | "overview"; label: string } {
  if (countdown < 0) return { tab: "money", label: "Ghi chi phí trong chuyến" };
  if (readiness.packLeft > 0 && countdown <= 7) return { tab: "packing", label: `Xếp đồ (${readiness.packLeft} món)` };
  if (readiness.daysPlanned < readiness.daysTotal) return { tab: "itin", label: `Lên lịch ${readiness.daysTotal - readiness.daysPlanned} ngày còn trống` };
  if (readiness.packLeft > 0) return { tab: "packing", label: `Xếp đồ (${readiness.packLeft} món)` };
  return { tab: "overview", label: "Mọi thứ sẵn sàng 🎉" };
}

/** Trips ordered for the list: upcoming/ongoing first (soonest start first), then done/cancelled (latest first). */
export function orderTrips(trips: Trip[], today: string): { active: Trip[]; past: Trip[] } {
  const active: Trip[] = []; const past: Trip[] = [];
  for (const trip of trips) (tripPhase(trip, today) === "planning" || tripPhase(trip, today) === "ongoing" ? active : past).push(trip);
  active.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { active, past };
}
