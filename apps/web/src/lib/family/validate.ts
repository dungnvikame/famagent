import { validBirthDate } from "../experience/validate.ts";

/** Request checks shared by /api/family/* and the demo-mode client. */
export const MAX_AVATAR_CHARS = 120_000;
const MEMBER_ID = /^[a-z0-9-]{1,40}$/;
const UUID = /^[a-f0-9-]{36}$/i;

export const validMemberId = (value: unknown): value is string => typeof value === "string" && MEMBER_ID.test(value);
export const validAvatarImage = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/jpeg;base64,") && value.length <= MAX_AVATAR_CHARS;

export interface WeightInput { childId: string; date: string; kg: number }
/** 1–40 kg (same bounds as the table), a real date not in the future and within 18 years. */
export function validWeightInput(value: unknown, now = new Date()): value is WeightInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.childId === "string" && UUID.test(input.childId) && validBirthDate(input.date, now)
    && typeof input.kg === "number" && Number.isFinite(input.kg) && input.kg >= 1 && input.kg <= 40;
}
