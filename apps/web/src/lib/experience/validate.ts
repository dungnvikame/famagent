import { DELIVERY_PREFERENCES, DIAPER_SIZES, FIELD_SOURCES, PRICE_PREFERENCES, SENSITIVITIES, SHOPPING_CONCERNS, WASHING_MACHINES, type FamilyProfile } from "./types.ts";

// Limits keep stored context small and to what product selection needs (PRODUCT.md §4).
const MAX_LIST = 10;
const MAX_TEXT = 40;
const UUID = /^[a-f0-9-]{36}$/i;

const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const inList = (list: readonly string[]) => (value: unknown) => typeof value === "string" && list.includes(value);
const shortText = (max: number) => (value: unknown) => typeof value === "string" && value.length <= max;
const textList = (value: unknown) => Array.isArray(value) && value.length <= MAX_LIST && value.every(shortText(MAX_TEXT));
const enumList = (list: readonly string[]) => (value: unknown) => Array.isArray(value) && value.length <= list.length && new Set(value).size === value.length && value.every(inList(list));
const number = (min: number, max: number, integer = false) => (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));

/**
 * YYYY-MM-DD, not in the future (1 day of timezone slack) and at most `maxYears` ago.
 * Stored data uses a loose bound so a saved date never ages into an invalid profile;
 * input forms limit new dates to INPUT_BIRTH_YEARS.
 */
export const INPUT_BIRTH_YEARS = 6;
export function validBirthDate(value: unknown, now = new Date(), maxYears = 18): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const oldest = new Date(Date.UTC(now.getUTCFullYear() - maxYears, now.getUTCMonth(), now.getUTCDate()));
  return date.getTime() <= now.getTime() + 86_400_000 && date.getTime() >= oldest.getTime();
}

function validOnboarding(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  // Slot ids look like "child.basics:<uuid>" (49 chars), so allow up to 80.
  const slots = (list: unknown) => Array.isArray(list) && list.length <= 30 && list.every(shortText(80));
  return state.version === 2 && slots(state.completedSlots) && slots(state.skippedSlots);
}

const isoTime = (value: unknown) => typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));

function validFieldMeta(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length <= 80 && entries.every(([path, meta]) => {
    const item = meta as Record<string, unknown> | null;
    return path.length <= 80 && !!item && typeof item === "object" && inList(FIELD_SOURCES)(item.source) && isoTime(item.observedAt) && optional(item.confirmedAt, isoTime);
  });
}

function validChild(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const child = value as Record<string, unknown>;
  return typeof child.id === "string" && UUID.test(child.id)
    && optional(child.name, shortText(80))
    && optional(child.birthDate, (date) => validBirthDate(date))
    && optional(child.weightKg, number(2, 30))
    && optional(child.ageMonths, number(0, 216, true))
    && optional(child.diaperSize, inList(DIAPER_SIZES))
    && optional(child.sensitivities, enumList(SENSITIVITIES))
    && optional(child.currentBrand, shortText(MAX_TEXT))
    && optional(child.preferredBrands, textList)
    && optional(child.dislikedBrands, textList);
}

export function validProfile(value: unknown): value is FamilyProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (!Array.isArray(p.children) || p.children.length > 5 || !inList(PRICE_PREFERENCES)(p.pricePreference)) return false;
  if (new Set(p.children.map((child) => child?.id)).size !== p.children.length) return false;
  const appliances = p.appliances as Record<string, unknown> | undefined;
  return typeof p.aiConsent === "boolean"
    && optional(p.familyName, shortText(80))
    && optional(p.adultsCount, number(1, 10, true))
    && optional(p.mainConcern, inList(SHOPPING_CONCERNS))
    && optional(p.deliveryPreference, inList(DELIVERY_PREFERENCES))
    && optional(p.maxBudget, number(50_000, 100_000_000, true))
    && optional(p.preferredBrands, textList)
    && optional(p.avoidedIngredients, textList)
    && optional(appliances, (item) => typeof item === "object" && item !== null && optional((item as Record<string, unknown>).washingMachine, inList(WASHING_MACHINES)))
    && optional(p.onboarding, validOnboarding)
    && optional(p.fieldMeta, validFieldMeta)
    && p.children.every(validChild);
}
