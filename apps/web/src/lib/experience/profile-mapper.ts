// Single mapping between Supabase rows (family_profiles + children) and FamilyProfile.
import type { ChildProfile, FamilyProfile, FieldMeta, OnboardingState } from "./types.ts";

type Row = Record<string, unknown>;

const text = (value: unknown) => typeof value === "string" && value ? value : undefined;
const list = <T extends string = string>(value: unknown) => Array.isArray(value) && value.length ? value as T[] : undefined;
/** Same ceiling as the age_months column and validation (18 years). */
const MAX_CHILD_MONTHS = 216;
const orNull =<T>(value: T | undefined) => value === undefined ? null : value;

function onboardingFromRow(value: unknown): OnboardingState | undefined {
  const state = value as Partial<OnboardingState> | null;
  return state?.version === 2 ? { version: 2, completedSlots: state.completedSlots ?? [], skippedSlots: state.skippedSlots ?? [] } : undefined;
}

function childFromRow(row: Row): ChildProfile {
  return {
    id: row.id as string,
    name: text(row.name),
    // Key only when set (column from migration 202609290022), so older rows map exactly as before.
    ...(row.sex === "male" || row.sex === "female" ? { sex: row.sex } : {}),
    birthDate: text(row.birth_date),
    weightKg: row.current_weight_kg === null || row.current_weight_kg === undefined ? undefined : Number(row.current_weight_kg),
    ageMonths: typeof row.age_months === "number" ? row.age_months : undefined,
    // Key only when set, so rows from before migration 202609290019 map exactly as they did.
    ...(text(row.age_as_of) ? { ageAsOf: text(row.age_as_of)!.slice(0, 10) } : {}),
    diaperSize: text(row.diaper_size),
    sensitivities: list(row.sensitivities),
    currentBrand: text(row.current_brand),
    preferredBrands: list(row.preferred_brands),
    dislikedBrands: list(row.disliked_brands),
  };
}

export function profileFromRow(row: Row): FamilyProfile {
  const children = Array.isArray(row.children) ? [...row.children as Row[]].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)) : [];
  const washingMachine = text(row.washing_machine) as NonNullable<FamilyProfile["appliances"]>["washingMachine"];
  return {
    id: row.id as string,
    familyName: text(row.name),
    adultsCount: typeof row.adults_count === "number" ? row.adults_count : undefined,
    pricePreference: row.price_preference as FamilyProfile["pricePreference"],
    deliveryPreference: text(row.delivery_preference) as FamilyProfile["deliveryPreference"],
    mainConcern: text(row.main_concern) as FamilyProfile["mainConcern"],
    maxBudget: typeof row.max_budget === "number" ? row.max_budget : undefined,
    preferredBrands: list(row.preferred_brands),
    avoidedIngredients: list(row.avoided_ingredients),
    appliances: washingMachine ? { washingMachine } : undefined,
    aiConsent: Boolean(row.ai_consent),
    onboarding: onboardingFromRow(row.onboarding),
    household: row.household && typeof row.household === "object" && Object.keys(row.household).length ? row.household as FamilyProfile["household"] : undefined,
    fieldMeta: row.field_meta && typeof row.field_meta === "object" && Object.keys(row.field_meta).length ? row.field_meta as Record<string, FieldMeta> : undefined,
    onboardedAt: text(row.onboarded_at),
    updatedAt: row.updated_at as string,
    children: children.map(childFromRow),
  };
}

/** Columns for family_profiles upsert (keyed by user_id). */
export function familyRow(profile: FamilyProfile, userId: string, now: string): Row {
  return {
    user_id: userId,
    name: profile.familyName || null,
    adults_count: orNull(profile.adultsCount),
    price_preference: profile.pricePreference,
    delivery_preference: orNull(profile.deliveryPreference),
    main_concern: orNull(profile.mainConcern),
    max_budget: orNull(profile.maxBudget),
    preferred_brands: profile.preferredBrands ?? [],
    avoided_ingredients: profile.avoidedIngredients ?? [],
    washing_machine: orNull(profile.appliances?.washingMachine),
    ai_consent: profile.aiConsent,
    onboarding: profile.onboarding ?? {},
    household: profile.household ?? {},
    field_meta: profile.fieldMeta ?? {},
    onboarded_at: profile.onboardedAt || null,
    updated_at: now,
  };
}

/** Columns for a children upsert; `position` keeps display order. */
export function childRow(child: ChildProfile, familyProfileId: string, position: number, now: string): Row {
  return {
    id: child.id,
    family_profile_id: familyProfileId,
    name: child.name || null,
    sex: child.sex ?? null,
    birth_date: child.birthDate || null,
    current_weight_kg: orNull(child.weightKg),
    age_months: orNull(child.ageMonths),
    age_as_of: child.ageMonths === undefined ? null : child.ageAsOf ?? null,
    diaper_size: child.diaperSize || null,
    sensitivities: child.sensitivities ?? [],
    current_brand: child.currentBrand || null,
    preferred_brands: child.preferredBrands ?? [],
    disliked_brands: child.dislikedBrands ?? [],
    position,
    updated_at: now,
  };
}

/** Whole calendar months from `from` (YYYY-MM-DD) to `now`, never negative. */
function monthsSince(from: string, now: Date): number {
  const start = new Date(`${from}T00:00:00Z`);
  // Not a real calendar date (or not ISO): no elapsed time can be derived from it.
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== from) return 0;
  const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth() - (now.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

/**
 * Months since birth when birthDate is known; otherwise the stored age plus the months elapsed since it was
 * given (ageAsOf), so a picked range does not freeze the child at that age. Without ageAsOf the stored age is used as is.
 */
export function childAgeMonths(child: ChildProfile, now = new Date()): number | undefined {
  if (child.birthDate) return monthsSince(child.birthDate, now);
  if (child.ageMonths === undefined || !child.ageAsOf) return child.ageMonths;
  return Math.min(MAX_CHILD_MONTHS, child.ageMonths + monthsSince(child.ageAsOf, now));
}
