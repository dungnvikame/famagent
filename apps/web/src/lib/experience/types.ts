import type { Product } from "@/lib/catalog/types";

export const PRICE_PREFERENCES = ["budget", "value", "balanced", "premium"] as const;
export const SHOPPING_CONCERNS = ["night", "leak", "soft", "sensitive", "value"] as const;
export const DELIVERY_PREFERENCES = ["cheapest", "fastest", "balanced"] as const;
export const SENSITIVITIES = ["sensitive_skin", "rash_prone", "fragrance_free"] as const;
export const WASHING_MACHINES = ["front", "top", "none"] as const;
export const DIAPER_SIZES = ["NB", "S", "M", "L", "XL", "XXL"] as const;
export const FIELD_SOURCES = ["user_entered", "user_confirmed"] as const;

export type PricePreference = (typeof PRICE_PREFERENCES)[number];
export const PRICE_PREFERENCE_LABELS: Record<PricePreference, string> = { budget: "Giá thấp nhất", value: "Giá trị tốt nhất", balanced: "Cân bằng", premium: "Cao cấp" };
export type ShoppingConcern = (typeof SHOPPING_CONCERNS)[number];
export const SHOPPING_CONCERN_LABELS: Record<ShoppingConcern, string> = { night: "dùng ban đêm", leak: "hạn chế tràn", soft: "mỏng nhẹ", sensitive: "da nhạy cảm", value: "giá theo đơn vị" };
export type DeliveryPreference = (typeof DELIVERY_PREFERENCES)[number];
export const DELIVERY_PREFERENCE_LABELS: Record<DeliveryPreference, string> = { cheapest: "phí giao thấp", fastest: "giao nhanh", balanced: "giao hàng cân bằng" };
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type WashingMachine = (typeof WASHING_MACHINES)[number];
export const WASHING_MACHINE_LABELS: Record<WashingMachine, string> = { front: "Cửa trước", top: "Cửa trên", none: "Không dùng máy giặt" };
export type FieldSource = (typeof FIELD_SOURCES)[number];

/**
 * Provenance of a confirmed profile value (spec v1 §6.1). Keyed by field path,
 * e.g. "maxBudget" or "children.<childId>.weightKg". Only confirmed values live in
 * the profile; tentative observations and inferred data belong to a later layer.
 */
export interface FieldMeta {
  source: FieldSource;
  observedAt: string;
  confirmedAt?: string;
}

export interface ChildProfile {
  id: string;
  name?: string;
  /** YYYY-MM-DD; preferred over ageMonths when both exist. */
  birthDate?: string;
  weightKg?: number;
  ageMonths?: number;
  diaperSize?: string;
  sensitivities?: Sensitivity[];
  currentBrand?: string;
  preferredBrands?: string[];
  dislikedBrands?: string[];
}

/** What the onboarding agent has already covered, so it never re-asks. */
export interface OnboardingState {
  version: 2;
  completedSlots: string[];
  skippedSlots: string[];
}

export interface FamilyProfile {
  id: string;
  familyName?: string;
  adultsCount?: number;
  children: ChildProfile[];
  pricePreference: PricePreference;
  deliveryPreference?: DeliveryPreference;
  mainConcern?: ShoppingConcern;
  maxBudget?: number;
  preferredBrands?: string[];
  avoidedIngredients?: string[];
  appliances?: { washingMachine?: WashingMachine };
  aiConsent: boolean;
  onboarding?: OnboardingState;
  fieldMeta?: Record<string, FieldMeta>;
  onboardedAt?: string;
  updatedAt: string;
}

export interface ShoppingIntent {
  category: "diapers" | "unsupported" | null;
  childName?: string;
  weightKg?: number;
  diaperSize?: string;
  maxPrice?: number;
  nightUse?: boolean;
  leakProtection?: boolean;
  sensitiveSkin?: boolean;
  brand?: string;
}

export interface Recommendation {
  product: Product;
  variantId: string;
  offerId: string;
  score: number;
  scores: { fit: number; quality: number; value: number; sellerTrust: number; availability: number; delivery: number; preference: number };
  reasons: string[];
  tradeoff?: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  recommendations?: Recommendation[];
  intent?: ShoppingIntent;
  candidateCount?: number;
  candidateProductIds?: string[];
  rankingVersion?: string;
  view?: AgentView;
}

export type AgentView = { kind: "family" | "saved" | "catalog" | "compare" | "product" | "history" | "help"; productId?: string };

export interface Conversation {
  id: string;
  title: string;
  turns: ChatTurn[];
  updatedAt: string;
}

export interface ChatResponse {
  text: string;
  intent: ShoppingIntent;
  recommendations: Recommendation[];
  candidateCount: number;
  candidateProductIds: string[];
  rankingVersion: string;
  question?: string;
  choices?: string[];
  mode: "ai" | "rules";
  view?: AgentView;
  profile?: FamilyProfile;
}
