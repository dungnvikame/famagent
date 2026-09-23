// Compare exactly the variant + offer that was recommended (spec §11, v1 §11.4), not whatever is cheapest now.
import { lowestOffer, pricePerPiece } from "./filter.ts";
import type { Product, ProductOffer, ProductVariant } from "./types.ts";

export const MAX_COMPARE = 3;
export interface CompareItem { product: Product; variant: ProductVariant; offer: ProductOffer | null; unitPrice: number | null }

/** `items=productId:variantId:offerId,...` (from recommendation cards) or legacy `products=id,id`. */
export function resolveCompareItems(products: Product[], params: { items?: string; products?: string }): CompareItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const result: CompareItem[] = [];
  const seen = new Set<string>();
  for (const token of (params.items ?? "").split(",").filter(Boolean)) {
    const [productId, variantId, offerId] = token.split(":");
    const product = byId.get(productId ?? "");
    const variant = product?.variants.find((entry) => entry.id === variantId);
    if (!product || !variant || seen.has(product.id)) continue;
    const offer = variant.offers.find((entry) => entry.id === offerId && entry.availability === "in_stock") ?? null;
    seen.add(product.id);
    result.push({ product, variant, offer, unitPrice: offer ? pricePerPiece(offer, variant) : null });
  }
  for (const productId of (params.products ?? "").split(",").filter(Boolean)) {
    const product = byId.get(productId);
    if (!product || seen.has(product.id)) continue;
    const match = lowestOffer(product);
    if (!match) continue;
    seen.add(product.id);
    result.push({ product, variant: match.variant, offer: match.offer, unitPrice: pricePerPiece(match.offer, match.variant) });
  }
  return result.slice(0, MAX_COMPARE);
}

export const compareToken = (productId: string, variantId: string, offerId: string) => `${productId}:${variantId}:${offerId}`;
