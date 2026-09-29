// Vietnam wall-clock helpers for server code: a UTC server is 7 hours behind, so `new Date()` local getters and
// `todayLocal()` give yesterday's date between 00:00 and 07:00 in Vietnam. Intl with an explicit zone is DST-safe.
const ZONE = "Asia/Ho_Chi_Minh";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function vnParts(instant: Date): Record<"year" | "month" | "day" | "hour" | "minute" | "second", number> {
  const found: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) if (part.type !== "literal") found[part.type] = Number(part.value);
  return found as ReturnType<typeof vnParts>;
}

/** Vietnam calendar date (YYYY-MM-DD) of `instant`. */
export function todayVn(instant: Date = new Date()): string {
  const { year, month, day } = vnParts(instant);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A Date whose *local* getters (getDate, getMonth, getHours…) read the Vietnam wall clock, so date-only helpers
 * that use local getters (monthKey, summarizeMonth, upcomingRecurring) work on any server time zone.
 * Not a real instant: never format it with toISOString or compare it with real timestamps.
 */
export function nowVn(instant: Date = new Date()): Date {
  const { year, month, day, hour, minute, second } = vnParts(instant);
  return new Date(year, month - 1, day, hour, minute, second);
}
