import type { CatalogFilters, Product, ProductOffer, ProductVariant } from "./types";

export function pricePerPiece(offer: ProductOffer, variant: ProductVariant): number | null {
  if (variant.quantity <= 0 || variant.quantityUnit !== "piece") return null;
  return offer.price / variant.quantity;
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
  const pairs = product.variants
    .filter((variant) => !filters.size || variant.size.toLocaleLowerCase("vi") === filters.size.toLocaleLowerCase("vi"))
    .flatMap((variant) => availableOffers(variant)
      .filter((offer) => filters.maxPrice === undefined || offer.price <= filters.maxPrice)
      .map((offer) => ({ variant, offer })));
  return pairs.sort((a, b) => a.offer.price - b.offer.price)[0] ?? null;
}

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  return products
    .filter((product) => {
      if (filters.brand && product.brand.toLocaleLowerCase("vi") !== filters.brand.toLocaleLowerCase("vi")) return false;
      if (filters.weightKg !== undefined && (filters.weightKg < product.diaper.minWeightKg || filters.weightKg > product.diaper.maxWeightKg)) return false;
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
