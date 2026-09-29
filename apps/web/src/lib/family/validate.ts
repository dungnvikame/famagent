import { validBirthDate } from "../experience/validate.ts";
import { knownMilestone } from "./milestones.ts";
import { knownTip } from "./age-guide-data.ts";

/** Request checks shared by /api/family/* and the demo-mode client. */
export const MAX_AVATAR_CHARS = 120_000;
const MEMBER_ID = /^[a-z0-9-]{1,40}$/;
const UUID = /^[a-f0-9-]{36}$/i;

export const validMemberId = (value: unknown): value is string => typeof value === "string" && MEMBER_ID.test(value);
export const validAvatarImage = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/jpeg;base64,") && value.length <= MAX_AVATAR_CHARS;

export interface MilestoneInput { childId: string; milestoneId: string; status: "done" | "not_yet"; on?: string }
/** A known milestone or guide-tip id ("Đã thử"), a status, and for "done" an optional real day not in the future. */
export function validMilestoneInput(value: unknown, now = new Date()): value is MilestoneInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.childId === "string" && UUID.test(input.childId) && (knownMilestone(input.milestoneId) || knownTip(input.milestoneId))
    && (input.status === "done" || input.status === "not_yet") && (input.on === undefined || validBirthDate(input.on, now));
}

/** One day's measurement of a child: weight, height or both. */
export interface MeasureInput { childId: string; date: string; kg?: number; cm?: number }
const within = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
/** 1–40 kg / 35–200 cm (same bounds as the table), at least one of them, a real date not in the future, ≤ 18 years ago. */
export function validMeasureInput(value: unknown, now = new Date()): value is MeasureInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.childId === "string" && UUID.test(input.childId) && validBirthDate(input.date, now)
    && (input.kg !== undefined || input.cm !== undefined)
    && (input.kg === undefined || within(input.kg, 1, 40)) && (input.cm === undefined || within(input.cm, 35, 200));
}
