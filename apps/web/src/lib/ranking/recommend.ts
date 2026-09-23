// Hard filter + two-level ranking (spec v1 §11). Commission/affiliate data never enters any score.
import { pricePerPiece } from "../catalog/filter.ts";
import { vnd } from "../catalog/format.ts";
import { isOfferFresh } from "../catalog/offer-status.ts";
import type { Product, ProductOffer, ProductVariant } from "../catalog/types.ts";
import type { ProductScores, Recommendation, ShoppingIntent } from "../experience/types.ts";

export const RANKING_VERSION = "product_score_v1";
export const OFFER_SCORE_VERSION = "offer_score_v1";
const TOP = 3;
const UNKNOWN_FIT = 40;
const WEIGHTS: Record<keyof ProductScores, number> = { requirementFit: 0.40, householdPreferenceFit: 0.20, evidenceQuality: 0.15, value: 0.15, purchaseContinuity: 0.10 };

export type RejectReason = "category" | "excluded_brand" | "weight" | "size" | "out_of_stock" | "price_total" | "price_unit";
export interface Rejection { productId: string; reasons: RejectReason[] }
interface Candidate { product: Product; variant: ProductVariant; offers: ProductOffer[] }

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const lowerSet = (items: string[] | undefined) => new Set((items ?? []).map((item) => item.toLocaleLowerCase("vi")));

/**
 * Keeps products with at least one in-stock offer that satisfies every hard constraint
 * (spec v1 §11.2) and records why each other product was rejected — never relaxes a constraint.
 */
export function hardFilter(products: Product[], intent: ShoppingIntent): { candidates: Candidate[]; rejected: Rejection[] } {
  const { weightKg, sizeLabel } = intent.requiredAttributes;
  const { maxTotalPriceVnd, maxUnitPriceVnd } = intent.constraints;
  const excluded = lowerSet(intent.constraints.excludedBrands);
  const candidates: Candidate[] = []; const rejected: Rejection[] = [];
  for (const product of products) {
    const reasons = new Set<RejectReason>();
    if (intent.categoryId !== product.category) reasons.add("category");
    if (excluded.has(product.brand.toLocaleLowerCase("vi"))) reasons.add("excluded_brand");
    if (weightKg !== undefined && (weightKg < product.diaper.minWeightKg || weightKg > product.diaper.maxWeightKg)) reasons.add("weight");
    let best: Candidate | null = null;
    const sized = sizeLabel ? product.variants.filter((variant) => variant.size.toUpperCase() === sizeLabel) : product.variants;
    if (!sized.length) reasons.add("size");
    let inStock = false; let underTotal = false;
    for (const variant of sized) {
      const offers = variant.offers.filter((offer) => {
        if (offer.availability !== "in_stock") return false;
        inStock = true;
        if (maxTotalPriceVnd !== undefined && offer.price > maxTotalPriceVnd) return false;
        underTotal = true;
        const unit = pricePerPiece(offer, variant);
        return maxUnitPriceVnd === undefined || (unit !== null && unit <= maxUnitPriceVnd);
      });
      if (!offers.length) continue;
      // One variant per product: the one whose cheapest eligible offer has the lowest unit price.
      const unit = Math.min(...offers.map((offer) => pricePerPiece(offer, variant) ?? Infinity));
      const bestUnit = best ? Math.min(...best.offers.map((offer) => pricePerPiece(offer, best!.variant) ?? Infinity)) : Infinity;
      if (unit < bestUnit) best = { product, variant, offers };
    }
    // Only the first constraint that empties the size-matching offers is recorded (no-result advice relies on it).
    if (sized.length && !best) reasons.add(!inStock ? "out_of_stock" : !underTotal ? "price_total" : "price_unit");
    const blocking = reasons.has("category") || reasons.has("excluded_brand") || reasons.has("weight");
    if (!blocking && best) candidates.push(best);
    else rejected.push({ productId: product.id, reasons: [...reasons] });
  }
  return { candidates, rejected };
}

/**
 * offer_score_v1: only offers of the same variant are compared (spec v1 §11.4). A price older than the
 * freshness window is not a verifiable price, so every fresh offer ranks before any stale one.
 */
export function rankOffers(variant: ProductVariant, offers: ProductOffer[], now = Date.now()): Array<{ offer: ProductOffer; score: number }> {
  const prices = offers.map((offer) => offer.price);
  const min = Math.min(...prices); const max = Math.max(...prices);
  return offers.map((offer) => {
    const parts: Array<[number, number]> = [[0.5, max === min ? 100 : clamp(100 - ((offer.price - min) / (max - min)) * 60)]];
    if (offer.sellerRating !== undefined) parts.push([0.25, clamp(offer.sellerRating * 20)]);
    const ageHours = (now - Date.parse(offer.updatedAt)) / 3_600_000;
    parts.push([0.25, Number.isNaN(ageHours) ? 30 : ageHours <= 24 ? 100 : ageHours <= 48 ? 70 : 30]);
    const weight = parts.reduce((sum, [w]) => sum + w, 0);
    return { offer, score: clamp(parts.reduce((sum, [w, value]) => sum + w * value, 0) / weight) };
  }).sort((a, b) => Number(isOfferFresh(b.offer, now)) - Number(isOfferFresh(a.offer, now)) || b.score - a.score || a.offer.price - b.offer.price || a.offer.id.localeCompare(b.offer.id));
}

const SOFT: Array<{ key: "nightUse" | "leakProtection" | "sensitiveSkin"; attr: "nightUseScore" | "absorbencyScore" | "sensitiveSkinScore"; label: string }> = [
  { key: "nightUse", attr: "nightUseScore", label: "dùng ban đêm" },
  { key: "leakProtection", attr: "absorbencyScore", label: "chống tràn/thấm hút" },
  { key: "sensitiveSkin", attr: "sensitiveSkinScore", label: "da nhạy cảm" },
];
const QUALITY_ATTRS = ["nightUseScore", "absorbencyScore", "softnessScore", "sensitiveSkinScore"] as const;

/** Weighted sum over known components only; unknown ones never get a free high score. */
export function combine(scores: ProductScores): number {
  const known = (Object.keys(WEIGHTS) as (keyof ProductScores)[]).filter((key) => scores[key] !== null);
  const weight = known.reduce((sum, key) => sum + WEIGHTS[key], 0);
  return weight ? clamp(known.reduce((sum, key) => sum + WEIGHTS[key] * (scores[key] as number), 0) / weight) : 0;
}

export function recommend(products: Product[], intent: ShoppingIntent, now = Date.now()): { candidateCount: number; candidateProductIds: string[]; rejected: Rejection[]; recommendations: Recommendation[] } {
  const { candidates, rejected } = hardFilter(products, intent);
  return { candidateCount: candidates.length, candidateProductIds: candidates.map((entry) => entry.product.id), rejected, recommendations: rankCandidates(candidates, intent, now) };
}

export type { Candidate };

/** Offer ranking per variant + product_score_v1 over hard-filtered candidates; top 3. */
export function rankCandidates(candidates: Candidate[], intent: ShoppingIntent, now = Date.now()): Recommendation[] {
  const unitOf = (candidate: Candidate, offer: ProductOffer) => pricePerPiece(offer, candidate.variant) ?? Infinity;
  const ranked = candidates.map((candidate) => ({ candidate, offers: rankOffers(candidate.variant, candidate.offers, now) }));
  const units = ranked.map(({ candidate, offers }) => unitOf(candidate, offers[0].offer));
  const minUnit = Math.min(...units); const maxUnit = Math.max(...units);
  const preferred = lowerSet(intent.preferences.preferredBrands);
  const priority = intent.preferences.priority;

  const items = ranked.map(({ candidate, offers }, index): Recommendation => {
    const { product, variant } = candidate;
    const offer = offers[0].offer;
    const unit = units[index];
    const matched: string[] = []; const tradeoffs: string[] = []; const failed: string[] = []; const evidence = [`product:${product.id}`, `variant:${variant.id}`, `offer:${offer.id}`];

    // requirement_fit: requested soft requirements scored from catalog evidence only.
    const requested = SOFT.filter((item) => intent.requiredAttributes[item.key]);
    const knownFit: number[] = [];
    for (const item of requested) {
      const value = product.diaper[item.attr];
      if (value === undefined) { tradeoffs.push(`Chưa có dữ liệu về ${item.label}`); continue; }
      knownFit.push(value * 20); evidence.push(`attr:${item.attr}`);
      if (value >= 3) matched.push(`Điểm ${item.label} trong catalog: ${value}/5`); else failed.push(item.label);
    }
    // A requested attribute without catalog data counts as a weak fit (below the 3/5 = 60 "matched" line):
    // unverified products must not outrank ones with sourced evidence (spec v1 §12 "missing key attribute").
    const unknownRequested = requested.length - knownFit.length;
    const requirementFit = !requested.length ? 100 : clamp((knownFit.reduce((a, b) => a + b, 0) + unknownRequested * UNKNOWN_FIT) / requested.length);

    // value: unit price relative to the other candidates (same pieces-based unit).
    const value = maxUnit === minUnit ? 75 : clamp(100 - ((unit - minUnit) / (maxUnit - minUnit)) * 70);

    // evidence_quality: how much sourced quality data exists, and how good it is.
    const known = QUALITY_ATTRS.map((attr) => product.diaper[attr]).filter((item): item is number => item !== undefined);
    const evidenceQuality = known.length ? clamp((known.length / QUALITY_ATTRS.length) * 50 + (known.reduce((a, b) => a + b, 0) / known.length) * 10) : null;

    // household_preference_fit: brand preference and price priority; unknown without signals.
    const signals: number[] = [];
    if (preferred.size) { const hit = preferred.has(product.brand.toLocaleLowerCase("vi")); signals.push(hit ? 100 : 40); if (hit) matched.push(`Thương hiệu gia đình ưu tiên: ${product.brand}`); }
    if (priority === "lowest_cost" || priority === "best_value") signals.push(value);
    if (priority === "quality" && evidenceQuality !== null) signals.push(evidenceQuality);
    const householdPreferenceFit = signals.length ? clamp(signals.reduce((a, b) => a + b, 0) / signals.length) : null;

    const scores: ProductScores = { requirementFit, householdPreferenceFit, evidenceQuality, value, purchaseContinuity: null };
    const { weightKg } = intent.requiredAttributes;
    const reasons = [
      weightKg !== undefined ? `Phù hợp ${weightKg} kg (dải ${product.diaper.minWeightKg}–${product.diaper.maxWeightKg} kg)` : `Dải cân nặng ${product.diaper.minWeightKg}–${product.diaper.maxWeightKg} kg`,
      `Size ${variant.size}, ${variant.quantity} miếng · ${vnd(Math.round(unit))}/miếng`,
      ...(intent.constraints.maxTotalPriceVnd !== undefined ? [`Trong ngân sách ${vnd(intent.constraints.maxTotalPriceVnd)}`] : []),
      ...matched,
    ];
    return { product, variantId: variant.id, offerId: offer.id, rank: 0, score: combine(scores), scoreVersion: RANKING_VERSION, scores, reasons, tradeoffs, failedSoftPreferences: failed, evidenceRefs: evidence };
  }).sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id)).slice(0, TOP);

  // Tradeoff vs. the cheapest per piece among the shown options (same unit, spec v1 §11.4).
  const unitById = new Map(items.map((item) => [item.product.id, units[ranked.findIndex((entry) => entry.candidate.product.id === item.product.id)]]));
  const cheapest = [...items].sort((a, b) => (unitById.get(a.product.id)! - unitById.get(b.product.id)!))[0];
  items.forEach((item, index) => {
    item.rank = index + 1;
    if (cheapest && cheapest.product.id !== item.product.id) {
      const gap = Math.round((1 - unitById.get(cheapest.product.id)! / unitById.get(item.product.id)!) * 100);
      if (gap >= 5) item.tradeoffs.unshift(`${cheapest.product.canonicalName} rẻ hơn khoảng ${gap}% mỗi miếng`);
    }
    item.tradeoff = item.tradeoffs[0];
  });
  return items;
}
