// Context resolver (spec v1 §7 merge rules): current message > earlier turns > confirmed profile.
// Excluded brands are always hard filters; conflicts become ambiguity codes the pipeline asks about.
import type { ChildProfile, ExtractedField, FamilyProfile, Priority, ShoppingIntent } from "../../experience/types.ts";
import type { ShoppingExtraction } from "./extract.ts";

const PRICE_TO_PRIORITY: Partial<Record<FamilyProfile["pricePreference"], Priority>> = { budget: "lowest_cost", value: "best_value", premium: "quality" };
const inRange = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const sizeOk = (value: unknown): value is string => typeof value === "string" && /^(NB|S|M|L|XL|XXL)$/.test(value);
const lowerSet = (items: string[]) => new Set(items.map((item) => item.toLocaleLowerCase("vi")));

type Candidate<T> = { value: T | undefined; source: ExtractedField["source"]; confidence: number };

/** First defined candidate wins; records where it came from. */
function pick<T>(evidence: Record<string, ExtractedField>, field: string, candidates: Array<Candidate<T>>): T | undefined {
  const chosen = candidates.find((candidate) => candidate.value !== undefined);
  if (chosen) evidence[field] = { value: chosen.value, source: chosen.source, confidence: chosen.confidence };
  return chosen?.value;
}

/** Which child the request is about; `ambiguous` when several could be meant and nothing identifies one. */
function resolveMember(extraction: ShoppingExtraction, profile: FamilyProfile | null, previous: ShoppingIntent | null): { child?: ChildProfile; name?: string; ambiguous: boolean } {
  const children = profile?.children ?? [];
  const named = extraction.childName ?? previous?.householdMemberRef;
  if (named) {
    let matches = children.filter((child) => child.name?.toLocaleLowerCase("vi") === named.toLocaleLowerCase("vi"));
    if (matches.length > 1) {
      const narrowed = matches.filter((child) => (extraction.weightKg !== null && child.weightKg === extraction.weightKg) || (extraction.sizeLabel !== null && child.diaperSize === extraction.sizeLabel));
      if (narrowed.length) matches = narrowed;
    }
    return { child: matches.length === 1 ? matches[0] : undefined, name: named, ambiguous: matches.length > 1 };
  }
  if (children.length === 1) return { child: children[0], name: children[0].name, ambiguous: false };
  // Several children and the message gives its own weight/size: no need to know which child.
  const selfContained = extraction.weightKg !== null || extraction.sizeLabel !== null;
  return { ambiguous: children.length > 1 && !selfContained };
}

export function mergeIntent(extraction: ShoppingExtraction, profile: FamilyProfile | null, previous: ShoppingIntent | null, mentions: { preferred: string[]; excluded: string[]; lifted?: string[] } = { preferred: [], excluded: [] }): ShoppingIntent {
  const evidence: Record<string, ExtractedField> = {};
  const ambiguity: string[] = [];
  const member = resolveMember(extraction, profile, previous);
  if (member.ambiguous) ambiguity.push("member");
  // Earlier-turn values only carry over for the same child.
  const samePrevious = previous && (!member.name || !previous.householdMemberRef || previous.householdMemberRef.toLocaleLowerCase("vi") === member.name.toLocaleLowerCase("vi")) ? previous : null;
  const msg = <T,>(value: T | null | undefined): Candidate<T> => ({ value: value ?? undefined, source: "user_message", confidence: 0.95 });
  const prev = <T,>(value: T | undefined): Candidate<T> => ({ value, source: "user_message", confidence: 0.8 });
  const fam = <T,>(value: T | undefined): Candidate<T> => ({ value, source: "family_profile", confidence: 1 });
  const child = member.child;

  const categoryId = pick(evidence, "categoryId", [msg(extraction.categoryId), prev(samePrevious?.categoryId)]);
  // Weight and size describe the same fit: when the message states one, the other is not pulled from
  // an older turn or the profile (a grown child with a stale size must not produce an empty result).
  const msgWeight = inRange(extraction.weightKg, 2, 30) ? extraction.weightKg : null;
  const msgSize = sizeOk(extraction.sizeLabel) ? extraction.sizeLabel : null;
  const stated = msgWeight !== null || msgSize !== null;
  const prevStated = samePrevious?.requiredAttributes.weightKg !== undefined || samePrevious?.requiredAttributes.sizeLabel !== undefined;
  const weightKg = pick(evidence, "weightKg", [msg(msgWeight), ...(stated ? [] : [prev(samePrevious?.requiredAttributes.weightKg), ...(prevStated ? [] : [fam(child?.weightKg)])])]);
  const sizeLabel = pick(evidence, "sizeLabel", [msg(msgSize), ...(stated ? [] : [prev(samePrevious?.requiredAttributes.sizeLabel), ...(prevStated ? [] : [fam(child?.diaperSize)])])]);
  const nightUse = pick(evidence, "nightUse", [msg(extraction.nightUse), prev(samePrevious?.requiredAttributes.nightUse), fam(profile?.mainConcern === "night" ? true : undefined)]);
  const leakProtection = pick(evidence, "leakProtection", [msg(extraction.leakProtection), prev(samePrevious?.requiredAttributes.leakProtection), fam(profile?.mainConcern === "leak" ? true : undefined)]);
  const sensitiveSkin = pick(evidence, "sensitiveSkin", [msg(extraction.sensitiveSkin), prev(samePrevious?.requiredAttributes.sensitiveSkin), fam(child?.sensitivities?.includes("sensitive_skin") || profile?.mainConcern === "sensitive" ? true : undefined)]);
  const msgTotal = inRange(extraction.maxTotalPriceVnd, 50_000, 100_000_000) ? extraction.maxTotalPriceVnd : null;
  const msgUnit = inRange(extraction.maxUnitPriceVnd, 500, 50_000) ? extraction.maxUnitPriceVnd : null;
  const priceLimitRemoved = extraction.removePriceLimit || (Boolean(previous?.constraints.priceLimitRemoved) && msgTotal === null && msgUnit === null);
  const maxTotalPriceVnd = priceLimitRemoved ? undefined : pick(evidence, "maxTotalPriceVnd", [msg(msgTotal), prev(previous?.constraints.maxTotalPriceVnd), fam(profile?.maxBudget)]);
  const maxUnitPriceVnd = priceLimitRemoved ? undefined : pick(evidence, "maxUnitPriceVnd", [msg(msgUnit), prev(previous?.constraints.maxUnitPriceVnd)]);
  const priority = pick(evidence, "priority", [msg(extraction.priority), prev(previous?.preferences.priority), fam(profile ? PRICE_TO_PRIORITY[profile.pricePreference] : undefined)]);

  // Exclusions accumulate from every source and are never overridden.
  // Unknown child with several children: apply every child's dislikes rather than silently none.
  const profileDislikes = child ? child.dislikedBrands ?? [] : (profile?.children ?? []).flatMap((item) => item.dislikedBrands ?? []);
  // A lift is honoured only as the answer to a brand_conflict question, and never against an exclusion
  // stated in the current message ("thôi, tránh X ra" re-excludes X — current message wins, spec v1 §7).
  const answeredConflict = Boolean(previous?.ambiguity.includes("brand_conflict"));
  const excludedNow = lowerSet(mentions.excluded);
  const liftedBrands = [...new Set([...(answeredConflict ? mentions.lifted ?? [] : []), ...(previous?.constraints.liftedBrands ?? [])])].filter((brand) => !excludedNow.has(brand.toLocaleLowerCase("vi")));
  const lifted = lowerSet(liftedBrands);
  const carried = [...(previous?.constraints.excludedBrands ?? []), ...profileDislikes].filter((brand) => !lifted.has(brand.toLocaleLowerCase("vi")));
  const excluded = [...new Set([...mentions.excluded, ...carried])];
  if (excluded.length) evidence.excludedBrands = { value: excluded, source: mentions.excluded.length ? "user_message" : "family_profile", confidence: 1 };
  const profileBrands = [...(child?.preferredBrands ?? []), ...(child?.currentBrand ? [child.currentBrand] : []), ...(profile?.preferredBrands ?? [])];
  const preferredBrands = pick(evidence, "preferredBrands", [msg(mentions.preferred.length ? mentions.preferred : null), prev(previous?.preferences.preferredBrands), fam(profileBrands.length ? [...new Set(profileBrands)] : undefined)]);
  // Asking for a brand that is also excluded is a contradiction: ask before searching (spec v1 §7).
  const excludedSet = lowerSet(excluded);
  if (mentions.preferred.some((brand) => excludedSet.has(brand.toLocaleLowerCase("vi")))) ambiguity.push("brand_conflict");
  const preferredClean = preferredBrands?.filter((brand) => !excludedSet.has(brand.toLocaleLowerCase("vi")));

  const intentType = extraction.intentType ?? (categoryId && (weightKg || sizeLabel || nightUse || maxTotalPriceVnd) ? "discover" : "unknown");
  return {
    schemaVersion: "1",
    intentType,
    householdMemberRef: member.name,
    categoryId,
    requiredAttributes: { weightKg, sizeLabel, nightUse, leakProtection, sensitiveSkin },
    constraints: { maxTotalPriceVnd, maxUnitPriceVnd, excludedBrands: excluded.length ? excluded : undefined, priceLimitRemoved: priceLimitRemoved || undefined, liftedBrands: liftedBrands.length ? liftedBrands : undefined },
    preferences: { priority, preferredBrands: preferredClean?.length ? preferredClean : undefined },
    fieldEvidence: evidence,
    ambiguity,
  };
}

/**
 * Ambiguity codes survive the round trip so an answer to a clarification (e.g. "Vẫn tìm X" after a
 * brand_conflict question) is recognised. A forged code only lets users lift their own exclusions,
 * which they can already do on the Family page.
 */
const allowedAmbiguity = (value: unknown): string[] => Array.isArray(value) ? value.filter((code): code is string => code === "brand_conflict" || code === "member") : [];

/**
 * Reads an intent stored by an earlier version (flat fields) or sent by the client, keeping only
 * well-formed values — client-held intents are untrusted input.
 */
export function upgradeIntent(value: unknown): ShoppingIntent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const num = (item: unknown, min: number, max: number) => inRange(item, min, max) ? item : undefined;
  const bool = (item: unknown) => item === true ? true : undefined;
  const brands = (item: unknown) => Array.isArray(item) ? item.filter((brand): brand is string => typeof brand === "string" && brand.length <= 40).slice(0, 10) : undefined;
  const category = (item: unknown) => item === "diapers" || item === "unsupported" ? item : undefined;
  if (raw.schemaVersion === "1") {
    const req = (raw.requiredAttributes ?? {}) as Record<string, unknown>;
    const cons = (raw.constraints ?? {}) as Record<string, unknown>;
    const pref = (raw.preferences ?? {}) as Record<string, unknown>;
    return {
      schemaVersion: "1", intentType: "discover", householdMemberRef: typeof raw.householdMemberRef === "string" ? raw.householdMemberRef.slice(0, 30) : undefined, categoryId: category(raw.categoryId),
      requiredAttributes: { weightKg: num(req.weightKg, 2, 30), sizeLabel: sizeOk(req.sizeLabel) ? req.sizeLabel : undefined, nightUse: bool(req.nightUse), leakProtection: bool(req.leakProtection), sensitiveSkin: bool(req.sensitiveSkin) },
      constraints: { maxTotalPriceVnd: num(cons.maxTotalPriceVnd, 50_000, 100_000_000), maxUnitPriceVnd: num(cons.maxUnitPriceVnd, 500, 50_000), excludedBrands: brands(cons.excludedBrands), priceLimitRemoved: cons.priceLimitRemoved === true || undefined, liftedBrands: brands(cons.liftedBrands) },
      preferences: { priority: typeof pref.priority === "string" && ["lowest_cost", "best_value", "quality", "fast_delivery"].includes(pref.priority) ? pref.priority as Priority : undefined, preferredBrands: brands(pref.preferredBrands) },
      fieldEvidence: {}, ambiguity: allowedAmbiguity(raw.ambiguity),
      pendingQuestion: ["weight_or_size", "member", "category", "brand_conflict", "price"].includes(raw.pendingQuestion as string) ? raw.pendingQuestion as ShoppingIntent["pendingQuestion"] : undefined,
    };
  }
  // Legacy flat shape (before spec v1).
  return {
    schemaVersion: "1", intentType: "discover", householdMemberRef: typeof raw.childName === "string" ? raw.childName.slice(0, 30) : undefined, categoryId: category(raw.category),
    requiredAttributes: { weightKg: num(raw.weightKg, 2, 30), sizeLabel: sizeOk(raw.diaperSize) ? raw.diaperSize : undefined, nightUse: bool(raw.nightUse), leakProtection: bool(raw.leakProtection), sensitiveSkin: bool(raw.sensitiveSkin) },
    constraints: { maxTotalPriceVnd: num(raw.maxPrice, 50_000, 100_000_000) },
    preferences: { preferredBrands: typeof raw.brand === "string" && raw.brand.length <= 40 ? [raw.brand] : undefined },
    fieldEvidence: {}, ambiguity: allowedAmbiguity(raw.ambiguity),
  };
}
