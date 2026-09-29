import type { CatalogFilters, Product, ProductOffer, ProductVariant } from "./types";

export function pricePerPiece(offer: ProductOffer, variant: ProductVariant): number | null {
  if (variant.quantity <= 0 || variant.quantityUnit !== "piece") return null;
  return offer.price / variant.quantity;
}

/** A variant's own weight range when both ends are known, else the product-level range. */
export function variantWeightRange(product: Product, variant: ProductVariant): { min: number; max: number } {
  if (variant.minWeightKg !== undefined && variant.maxWeightKg !== undefined) return { min: variant.minWeightKg, max: variant.maxWeightKg };
  return { min: product.diaper.minWeightKg, max: product.diaper.maxWeightKg };
}

export function variantFitsWeight(product: Product, variant: ProductVariant, weightKg: number): boolean {
  const { min, max } = variantWeightRange(product, variant);
  return weightKg >= min && weightKg <= max;
}

const sameSize = (a: string, b: string) => a.toLocaleLowerCase("vi") === b.toLocaleLowerCase("vi");

/**
 * Variants that may be shown for a child. Weight decides: only variants whose range contains the weight
 * qualify. When the product sells the asked size but its range excludes the weight, the size label is
 * dropped (weight wins over a stale/mistaken size); a product without that size at all stays excluded.
 * Without a weight the size label filters as usual.
 */
export function eligibleVariants(product: Product, { weightKg, size }: { weightKg?: number; size?: string }): { variants: ProductVariant[]; sizeDropped: boolean } {
  const bySize = (list: ProductVariant[]) => (size ? list.filter((variant) => sameSize(variant.size, size)) : list);
  if (weightKg === undefined) return { variants: bySize(product.variants), sizeDropped: false };
  const fitting = product.variants.filter((variant) => variantFitsWeight(product, variant, weightKg));
  const sized = bySize(fitting);
  if (sized.length || !size) return { variants: sized, sizeDropped: false };
  return bySize(product.variants).length ? { variants: fitting, sizeDropped: fitting.length > 0 } : { variants: [], sizeDropped: false };
}

export function availableOffers(variant: ProductVariant): ProductOffer[] {
  return variant.offers.filter((offer) => offer.availability === "in_stock");
}

export function lowestOffer(product: Product): { variant: ProductVariant; offer: ProductOffer } | null {
  const pairs = product.variants.flatMap((variant) =>
    availableOffers(variant).map((offer) => ({ variant, offer })),
  );
  return pairs.sort((a, b) => a.offer.price - b.offer.price)[0] ?? null;
}

export function lowestMatchingOffer(product: Product, filters: CatalogFilters): { variant: ProductVariant; offer: ProductOffer } | null {
  const pairs = eligibleVariants(product, filters).variants
    .flatMap((variant) => availableOffers(variant)
      .filter((offer) => filters.maxPrice === undefined || offer.price <= filters.maxPrice)
      .map((offer) => ({ variant, offer })));
  return pairs.sort((a, b) => a.offer.price - b.offer.price)[0] ?? null;
}

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  return products
    .filter((product) => {
      if (filters.brand && product.brand.toLocaleLowerCase("vi") !== filters.brand.toLocaleLowerCase("vi")) return false;
      return lowestMatchingOffer(product, filters) !== null;
    })
    .sort((a, b) => (lowestMatchingOffer(a, filters)?.offer.price ?? Infinity) - (lowestMatchingOffer(b, filters)?.offer.price ?? Infinity));
}

export function parseFilters(input: URLSearchParams): CatalogFilters {
  const number = (key: string): number | undefined => {
    const raw = input.get(key);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return {
    weightKg: number("weightKg"),
    maxPrice: number("maxPrice"),
    size: input.get("size")?.trim() || undefined,
    brand: input.get("brand")?.trim() || undefined,
  };
}
