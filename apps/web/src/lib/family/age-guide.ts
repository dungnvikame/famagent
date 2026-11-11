import type { GuideStage, GuideTip } from "./age-guide-data.ts";

/**
 * Tip of the day for the age guide — one function for the page ("Mẹo hôm nay") and the 8:00 push, so both show the
 * same tip. Rotates by the calendar day among the stage's tips the family has not tried yet.
 */
const DAY_MS = 86_400_000;
/** Day number of a YYYY-MM-DD date (the same on every device and on the server). */
export const dayNumberOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export function tipOfDay(stage: GuideStage, tried: ReadonlySet<string>, today: string): GuideTip | undefined {
  const fresh = stage.tips.filter((tip) => !tried.has(tip.id));
  return fresh.length ? fresh[dayNumberOf(today) % fresh.length] : undefined;
}

