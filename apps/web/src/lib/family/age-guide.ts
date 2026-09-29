import type { GuideStage, GuideTip } from "./age-guide-data.ts";
import { stageFor } from "./age-guide-data.ts";

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

export interface TipPush { title: string; body: string; url: string; tag: string }
/**
 * The morning push: for the youngest child under 6 (their stage changes fastest), today's untried tip.
 * `children` = name + age in months; null when no child is in range or every tip was tried.
 */
export function tipPushFor(children: Array<{ id: string; name: string; ageMonths?: number }>, triedByChild: ReadonlyMap<string, ReadonlySet<string>>, today: string): (TipPush & { childId: string; tipId: string }) | null {
  const candidates = children.filter((child) => child.ageMonths !== undefined && child.ageMonths < 72).sort((a, b) => a.ageMonths! - b.ageMonths!);
  for (const child of candidates) {
    const stage = stageFor(child.ageMonths!);
    const tip = stage && tipOfDay(stage, triedByChild.get(child.id) ?? new Set(), today);
    if (tip) return { childId: child.id, tipId: tip.id, title: `Mẹo hôm nay cho ${child.name} (${stage.label})`, body: tip.text, url: "/family#fam-guide", tag: "guide-tip" };
  }
  return null;
}
