// Records provenance (spec v1 §6.1) for profile values the user entered or confirmed.
import type { ChildProfile, FamilyProfile, FieldMeta, FieldSource } from "./types.ts";

const FAMILY_FIELDS = ["familyName", "adultsCount", "pricePreference", "deliveryPreference", "mainConcern", "maxBudget", "preferredBrands", "avoidedIngredients"] as const;
const CHILD_FIELDS = ["name", "birthDate", "weightKg", "ageMonths", "diaperSize", "sensitivities", "currentBrand", "preferredBrands", "dislikedBrands"] as const;

/** Flattens a profile into `path → value` using the same paths as fieldMeta keys. */
export function profileFieldValues(profile: FamilyProfile): Map<string, unknown> {
  const values = new Map<string, unknown>();
  for (const field of FAMILY_FIELDS) values.set(field, profile[field]);
  values.set("appliances.washingMachine", profile.appliances?.washingMachine);
  for (const child of profile.children) for (const field of CHILD_FIELDS) values.set(`children.${child.id}.${field}`, child[field as keyof ChildProfile]);
  return values;
}

const empty = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Field paths whose value differs between two profiles (UI highlights these after a turn or edit). */
export function changedPaths(before: FamilyProfile | null, after: FamilyProfile): Set<string> {
  const previous = before ? profileFieldValues(before) : new Map<string, unknown>();
  return new Set([...profileFieldValues(after)].filter(([path, value]) => !empty(value) && !same(previous.get(path), value)).map(([path]) => path));
}

/**
 * Returns `after` with fieldMeta updated: only values that actually changed are stamped
 * with `source` and confirmed now. Unchanged values keep their existing meta (or stay
 * without meta — provenance is never invented); cleared values and removed children lose it.
 */
export function stampChanges(before: FamilyProfile | null, after: FamilyProfile, source: FieldSource, now = new Date().toISOString()): FamilyProfile {
  const previous = before ? profileFieldValues(before) : new Map<string, unknown>();
  const current = profileFieldValues(after);
  const meta: Record<string, FieldMeta> = {};
  for (const [path, value] of current) {
    if (empty(value)) continue;
    const existing = after.fieldMeta?.[path];
    if (!same(previous.get(path), value)) meta[path] = { source, observedAt: now, confirmedAt: now };
    else if (existing) meta[path] = existing;
  }
  return { ...after, fieldMeta: Object.keys(meta).length ? meta : undefined };
}
