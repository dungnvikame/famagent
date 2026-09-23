import { filterProducts, lowestMatchingOffer, pricePerPiece } from "@/lib/catalog/filter";
import { vnd } from "@/lib/catalog/format";
import type { Product } from "@/lib/catalog/types";
import type { FamilyProfile, Recommendation, ShoppingIntent } from "@/lib/experience/types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const score5 = (value: number | undefined) => value === undefined ? 50 : clamp(value * 20);

export const RANKING_VERSION = "diapers-v2";

export function recommend(products: Product[], intent: ShoppingIntent, profile: FamilyProfile | null): { candidateCount: number; candidateProductIds: string[]; recommendations: Recommendation[] } {
  if (intent.category !== "diapers") return { candidateCount: 0, candidateProductIds: [], recommendations: [] };
  const filters = { weightKg: intent.weightKg, size: intent.diaperSize, maxPrice: intent.maxPrice, brand: intent.brand };
  const candidates = filterProducts(products, filters);
  const entries = candidates.map((product) => ({ product, match: lowestMatchingOffer(product, filters) })).filter((entry): entry is { product: Product; match: NonNullable<typeof entry.match> } => entry.match !== null);
  const unitPrices = entries.map(({ match }) => pricePerPiece(match.offer, match.variant) ?? Infinity);
  const min = Math.min(...unitPrices); const max = Math.max(...unitPrices);
  const recommendations = entries.map(({ product, match }): Recommendation => {
    const unitPrice = pricePerPiece(match.offer, match.variant) ?? 0;
    const night = score5(product.diaper.nightUseScore);
    const absorption = score5(product.diaper.absorbencyScore);
    const skin = score5(product.diaper.sensitiveSkinScore);
    const qualityValues = [product.diaper.nightUseScore, product.diaper.absorbencyScore, product.diaper.softnessScore, product.diaper.sensitiveSkinScore].filter((value): value is number => value !== undefined);
    const quality = qualityValues.length ? clamp(qualityValues.reduce((sum, value) => sum + value * 20, 0) / qualityValues.length) : 50;
    const fitFactors: number[] = [];
    if (intent.nightUse) fitFactors.push(night);
    if (intent.leakProtection) fitFactors.push(absorption);
    if (intent.sensitiveSkin) fitFactors.push(skin);
    const fit = fitFactors.length ? clamp(fitFactors.reduce((sum, value) => sum + value, 0) / fitFactors.length) : 100;
    const value = max === min ? 75 : clamp(100 - ((unitPrice - min) / (max - min)) * 70);
    const sellerTrust = 50; const availability = 100; const delivery = 50;
    const preference = profile?.pricePreference === "budget" ? value : profile?.pricePreference === "premium" ? quality : clamp((value + quality) / 2);
    const scores = { fit, quality, value, sellerTrust, availability, delivery, preference };
    const score = clamp(fit * .35 + quality * .20 + value * .20 + sellerTrust * .10 + availability * .05 + delivery * .05 + preference * .05);
    const reasons = [
      intent.weightKg ? `Phù hợp ${intent.weightKg} kg (dải ${product.diaper.minWeightKg}–${product.diaper.maxWeightKg} kg)` : `Dải cân nặng ${product.diaper.minWeightKg}–${product.diaper.maxWeightKg} kg`,
      `Size ${match.variant.size}, ${match.variant.quantity} miếng · ${vnd(unitPrice)}/miếng`,
    ];
    if (intent.nightUse && product.diaper.nightUseScore !== undefined) reasons.push(`Điểm dùng ban đêm trong catalog: ${product.diaper.nightUseScore}/5`);
    if (intent.leakProtection && product.diaper.absorbencyScore !== undefined) reasons.push(`Điểm thấm hút trong catalog: ${product.diaper.absorbencyScore}/5`);
    return { product, variantId: match.variant.id, offerId: match.offer.id, score, scores, reasons };
  }).sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id)).slice(0, 5);
  if (recommendations.length > 1) {
    const cheapest = [...recommendations].sort((a, b) => {
      const unit = (item: Recommendation) => { const variant = item.product.variants.find((v) => v.id === item.variantId)!; return pricePerPiece(variant.offers.find((o) => o.id === item.offerId)!, variant) ?? Infinity; };
      return unit(a) - unit(b);
    })[0];
    if (cheapest.product.id !== recommendations[0].product.id) recommendations[0].tradeoff = `${cheapest.product.canonicalName} có giá mỗi miếng thấp hơn.`;
  }
  return { candidateCount: candidates.length, candidateProductIds: candidates.map((product) => product.id), recommendations };
}
