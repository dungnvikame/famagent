import type { MoneyTransaction } from "./types.ts";

/** One month of a backfilled monthly saving transfer; `skip` when that month already has one of the same amount. */
export interface BackfillLine { month: string; occurredOn: string; skip: boolean }

const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while ((y < ty || (y === ty && m <= tm)) && out.length < 240) { out.push(`${y}-${String(m).padStart(2, "0")}`); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
};

/** Monthly saving transfers from..to (YYYY-MM, inclusive) on `day` (clamped to the month's length). */
export function backfillPlan(amount: number, day: number, from: string, to: string, existing: Array<Pick<MoneyTransaction, "kind" | "amount" | "occurredOn">>): BackfillLine[] {
  return monthsBetween(from, to).map((month) => {
    const [y, m] = month.split("-").map(Number);
    const date = `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
    return { month, occurredOn: date, skip: existing.some((tx) => tx.kind === "saving" && tx.amount === amount && tx.occurredOn.startsWith(month)) };
  });
}

/** "05/2025" → "2025-05" (null when not a month). */
export function parseMonthInput(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? `${match[2]}-${String(month).padStart(2, "0")}` : null;
}
