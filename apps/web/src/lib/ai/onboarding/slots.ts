// Onboarding slots: what the agent asks, in which order, and when a slot counts as done.
// Pure code — the LLM never decides the flow (plan P3, spec v1 §5).
import type { FamilyProfile } from "../../experience/types.ts";

export type SlotKind = "household" | "child.basics" | "child.care" | "preferences" | "home";
export interface Slot { kind: SlotKind; childId?: string; required: boolean }
export type ActiveSlot = Slot | { kind: "review" };

/** Stable id stored in profile.onboarding.completedSlots/skippedSlots, e.g. "child.basics:<uuid>". */
export const slotId = (slot: Slot) => slot.childId ? `${slot.kind}:${slot.childId}` : slot.kind;

/** Ordered slots for the current profile; each child gets basics then care (at least one child). */
export function slotsFor(profile: FamilyProfile): Slot[] {
  const children = profile.children.length ? profile.children : [{ id: undefined }];
  return [
    { kind: "household", required: false },
    ...children.flatMap((child) => [
      { kind: "child.basics" as const, childId: child.id, required: true },
      { kind: "child.care" as const, childId: child.id, required: false },
    ]),
    { kind: "preferences", required: false },
    { kind: "home", required: false },
  ];
}

/** True when the profile already holds data that answers the slot. */
export function slotSatisfied(slot: Slot, profile: FamilyProfile): boolean {
  const child = profile.children.find((item) => item.id === slot.childId);
  switch (slot.kind) {
    case "household": return profile.adultsCount !== undefined;
    case "child.basics": return Boolean(child && (child.weightKg !== undefined || child.diaperSize));
    case "child.care": return Boolean(child && (child.sensitivities?.length || child.currentBrand || child.preferredBrands?.length || child.dislikedBrands?.length));
    // The default pricePreference is not an answer; only explicit values count.
    case "preferences": return Boolean(profile.maxBudget || profile.mainConcern || profile.deliveryPreference || profile.fieldMeta?.pricePreference);
    case "home": return Boolean(profile.appliances?.washingMachine);
  }
}

export function slotDone(slot: Slot, profile: FamilyProfile): boolean {
  const id = slotId(slot);
  const state = profile.onboarding;
  return Boolean(state?.completedSlots.includes(id) || state?.skippedSlots.includes(id)) || slotSatisfied(slot, profile);
}

export function nextSlot(profile: FamilyProfile): ActiveSlot {
  return slotsFor(profile).find((slot) => !slotDone(slot, profile)) ?? { kind: "review" };
}

/** Returns a copy of the profile with the slot marked completed or skipped (idempotent). */
export function markSlot(profile: FamilyProfile, slot: Slot, as: "completed" | "skipped"): FamilyProfile {
  const state = profile.onboarding ?? { version: 2 as const, completedSlots: [], skippedSlots: [] };
  const id = slotId(slot);
  const completedSlots = state.completedSlots.filter((item) => item !== id);
  const skippedSlots = state.skippedSlots.filter((item) => item !== id);
  (as === "completed" ? completedSlots : skippedSlots).push(id);
  return { ...profile, onboarding: { version: 2, completedSlots: completedSlots.slice(-30), skippedSlots: skippedSlots.slice(-30) } };
}

/** Required slots the user skipped — /shop will ask again before recommending. */
export function missingRequired(profile: FamilyProfile): Slot[] {
  return slotsFor(profile).filter((slot) => slot.required && !slotSatisfied(slot, profile));
}
