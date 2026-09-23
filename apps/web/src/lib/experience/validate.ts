import type { FamilyProfile } from "./types";

export function validProfile(value: unknown): value is FamilyProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (!Array.isArray(p.children) || p.children.length > 5 || !["budget", "balanced", "premium"].includes(String(p.pricePreference))) return false;
  if (p.mainConcern !== undefined && !["night", "leak", "soft", "sensitive", "value"].includes(String(p.mainConcern))) return false;
  if (new Set(p.children.map((child) => child?.id)).size !== p.children.length) return false;
  if (typeof p.aiConsent !== "boolean" || (p.familyName !== undefined && (typeof p.familyName !== "string" || p.familyName.length > 80))) return false;
  if (p.maxBudget !== undefined && (!Number.isInteger(p.maxBudget) || Number(p.maxBudget) < 50000 || Number(p.maxBudget) > 100000000)) return false;
  return p.children.every((child) => child && typeof child === "object" && typeof child.id === "string" && /^[a-f0-9-]{36}$/i.test(child.id) &&
    (child.name === undefined || (typeof child.name === "string" && child.name.length <= 80)) &&
    (child.weightKg === undefined || (typeof child.weightKg === "number" && child.weightKg >= 2 && child.weightKg <= 30)) &&
    (child.ageMonths === undefined || (Number.isInteger(child.ageMonths) && child.ageMonths >= 0 && child.ageMonths <= 216)) &&
    (child.diaperSize === undefined || ["NB", "S", "M", "L", "XL", "XXL"].includes(child.diaperSize)));
}
