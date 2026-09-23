export type Category = "diapers";

export interface DiaperAttributes {
  minWeightKg: number;
  maxWeightKg: number;
  type: "tape" | "pants";
  nightUseScore?: number;
  absorbencyScore?: number;
  softnessScore?: number;
  thicknessScore?: number;
  sensitiveSkinScore?: number;
}

export interface ProductOffer {
  id: string;
  merchantId: string;
  merchantName: string;
  source: "shopee" | "tiktok" | "lazada" | "affiliate" | "direct";
  price: number;
  currency: "VND";
  availability: "in_stock" | "out_of_stock" | "unknown";
  updatedAt: string;
  // Không trả affiliate URL qua API public; redirect sẽ được làm ở milestone sau.
}

export interface ProductVariant {
  id: string;
  name: string;
  size: string;
  quantity: number;
  quantityUnit: "piece";
  offers: ProductOffer[];
}

export interface Product {
  id: string;
  slug: string;
  canonicalName: string;
  brand: string;
  category: Category;
  description?: string;
  imageUrl?: string;
  diaper: DiaperAttributes;
  variants: ProductVariant[];
  isDemo?: boolean;
}

export interface CatalogFilters {
  weightKg?: number;
  size?: string;
  maxPrice?: number;
  brand?: string;
}

