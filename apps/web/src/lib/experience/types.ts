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

/** Intents the agent recognises (spec v1 §7). MVP handles discover/compare/update_family; the rest answer "coming soon". */
export const INTENT_TYPES = ["discover", "compare", "reorder", "check_replenishment", "monthly_basket", "price_check", "update_family", "unknown"] as const;
export type IntentType = (typeof INTENT_TYPES)[number];
export const PRIORITIES = ["lowest_cost", "best_value", "quality", "fast_delivery"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Where a merged intent field came from (spec v1 §7 SourceType); previous turns count as user_message. */
export interface ExtractedField { value: unknown; source: "user_message" | "family_profile" | "purchase_history"; confidence: number }

/** Category-specific hard/soft requirements; only diapers in the MVP. */
export interface DiaperRequirements {
  weightKg?: number;
  sizeLabel?: string;
  nightUse?: boolean;
  leakProtection?: boolean;
  sensitiveSkin?: boolean;
}

/** Structured request the pipeline works on (spec v1 §7). */
export interface ShoppingIntent {
  schemaVersion: "1";
  intentType: IntentType;
  /** Child name (display) the request is for, when known. */
  householdMemberRef?: string;
  categoryId?: "diapers" | "unsupported";
  requiredAttributes: DiaperRequirements;
  /** priceLimitRemoved: the user said "bỏ giới hạn giá" — stays off until they state a new price. */
  /** liftedBrands: exclusions the user overrode in this conversation ("vẫn tìm X"); the profile is unchanged. */
  constraints: { maxTotalPriceVnd?: number; maxUnitPriceVnd?: number; excludedBrands?: string[]; priceLimitRemoved?: boolean; liftedBrands?: string[] };
  preferences: { priority?: Priority; preferredBrands?: string[] };
  fieldEvidence: Record<string, ExtractedField>;
  /** Codes of unresolved ambiguity, e.g. "member" when several children could be meant. */
  ambiguity: string[];
  /** Clarification asked in this turn; the next short yes/no is read against it (lib/ai/shopping/pending). */
  pendingQuestion?: "weight_or_size" | "member" | "category" | "brand_conflict" | "price";
}

/** product_score_v1 components (0–100); null = unknown, excluded from the weighted sum (spec v1 §11.3). */
export interface ProductScores {
  requirementFit: number | null;
  householdPreferenceFit: number | null;
  evidenceQuality: number | null;
  value: number | null;
  purchaseContinuity: number | null;
}

/** One ranked product (spec v1 §11.5) plus the product/variant/offer the UI renders. */
export interface Recommendation {
  product: Product;
  variantId: string;
  /** Best offer for the variant by offer_score_v1 (spec v1 §11.4). */
  offerId: string;
  rank: number;
  score: number;
  scoreVersion: string;
  scores: ProductScores;
  /** Also shown as reasons in the card. */
  reasons: string[];
  tradeoffs: string[];
  failedSoftPreferences: string[];
  evidenceRefs: string[];
  /** Legacy single tradeoff line (first of tradeoffs), kept for existing UI. */
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
  /** Quick replies offered with a clarification (e.g. "Bỏ giới hạn giá"). */
  choices?: string[];
  /** Family notes recorded from this message (shown as “Ghi nhận” chips). */
  notesRecorded?: string[];
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
  notesRecorded?: string[];
}
