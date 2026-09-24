// Timeline markers (phase 3): paydays from the family's recurring income and the big Vietnamese online sale days.
// "Có thể chờ sale" is only said when stock lasts until the sale and the plan is within budget — never to spend more.
import type { MoneyRecurring } from "../money/types.ts";
import { addDays, type ItemEstimate } from "./items.ts";

export interface CalendarMarker { on: string; label: string; kind: "payday" | "sale" }

/** Lunar New Year days (Tết) for the next few years; the sale marker sits ~10 days before. */
const TET: Record<number, string> = { 2026: "2026-02-17", 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03" };

const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Double days (1.1 … 12.12, the Shopee/Lazada/TikTok mega sales), Black Friday and pre-Tết, within [from, to]. */
export function saleDays(from: string, to: string): CalendarMarker[] {
  const out: CalendarMarker[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    for (let month = 1; month <= 12; month++) out.push({ on: iso(year, month, month), label: `sale ${month}.${month}`, kind: "sale" });
    const firstThursday = 1 + (4 - new Date(year, 10, 1).getDay() + 7) % 7;
    out.push({ on: iso(year, 11, firstThursday + 22), label: "Black Friday", kind: "sale" });
  }
  for (const tet of Object.values(TET)) out.push({ on: addDays(tet, -10), label: "sale Tết", kind: "sale" });
  return out.filter((marker) => marker.on >= from && marker.on <= to).sort((a, b) => a.on.localeCompare(b.on));
}

/** Paydays in [from, to] from active recurring income (day of month, clamped to the month's length). */
export function paydays(recurring: MoneyRecurring[], from: string, to: string): CalendarMarker[] {
  const out: CalendarMarker[] = [];
  for (const item of recurring.filter((entry) => entry.active && entry.kind === "income")) {
    for (let cursor = `${from.slice(0, 7)}-01`; cursor <= to; cursor = addDays(`${cursor.slice(0, 7)}-28`, 5).slice(0, 7) + "-01") {
      const [year, month] = cursor.split("-").map(Number);
      const on = iso(year, month, Math.min(item.dayOfMonth, new Date(year, month, 0).getDate()));
      if (on >= from && on <= to) out.push({ on, label: item.name.length > 12 ? "lương" : item.name.toLocaleLowerCase("vi"), kind: "payday" });
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on));
}

/** The next sale day the item's stock still covers (tomorrow or later), when the plan is not over budget. */
export function waitForSale(estimate: ItemEstimate, sales: CalendarMarker[], today: string, overBudget: boolean): CalendarMarker | null {
  if (overBudget || !estimate.runsOutOn || estimate.daysLeft === null || estimate.daysLeft < 2) return null;
  return sales.find((sale) => sale.kind === "sale" && sale.on > today && sale.on <= estimate.runsOutOn!) ?? null;
}
