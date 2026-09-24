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

export const HOUSEHOLD_SETUPS = ["couple", "single_parent", "multigen", "expecting", "no_kids"] as const;
export const HOUSING_TYPES = ["own", "rent", "with_parents"] as const;
export const SAVING_GOALS = ["emergency", "education", "home", "car", "travel", "retirement"] as const;
export const CARE_WORRIES = ["nutrition", "sleep", "health", "development", "cost", "birth_prep", "caregiver"] as const;
export const MONEY_PAINS = ["short_month_end", "unknown_spending", "cant_save", "debt", "couple_disagree"] as const;
export const TRACKING_METHODS = ["none", "spreadsheet", "app", "memory"] as const;
export const EMERGENCY_LEVELS = ["none", "lt3", "3to6", "gt6"] as const;
/** Money frameworks the family can pick (definitions in lib/money/frameworks). */
export const MONEY_METHODS = ["jars", "50-30-20", "pay-first", "zero-based", "kakeibo", "baby-steps"] as const;
/** Deep financial check (FinHealth-style indicators, lib/money/health). */
export const INCOME_STABILITY = ["stable_both", "stable_one", "irregular"] as const;
export const BILL_TIMELINESS = ["always", "sometimes", "often_late"] as const;
export const DEBT_TYPES = ["mortgage", "car", "installment", "credit_card", "consumer_loan", "family"] as const;
export const LONG_TERM_SAVINGS = ["bank_term", "gold", "property", "stocks", "life_insurance", "none"] as const;
export const INSURANCE_TYPES = ["public_health", "private_health", "life_main_earner", "none"] as const;
export const PLANNING_LEVELS = ["specific", "rough", "none"] as const;
/** Child care check (Nurturing Care Framework, lib/care/nurturing) and parenting approaches (lib/care/methods). */
export const CARE_METHODS = ["easy", "rie", "montessori", "positive-discipline", "emotion-coaching", "french"] as const;
export const VACCINE_STATUS = ["on_track", "late", "unsure"] as const;
export const CHECKUP_RECENCY = ["recent", "year", "long"] as const;
export const NUTRITION_LEVELS = ["varied", "picky", "snacks"] as const;
export const SLEEP_QUALITY = ["good", "irregular", "short"] as const;
export const PLAY_TIME = ["gt60", "30to60", "lt30"] as const;
export const SCREEN_TIME = ["none", "lt1h", "1to2h", "gt2h"] as const;
export const READING_FREQ = ["daily", "sometimes", "rarely"] as const;
export const SAFETY_MEASURES = ["stairs", "outlets", "chemicals", "vehicle", "none"] as const;
export const HOUSEHOLD_FOCUS = ["money", "shopping", "replenish", "care", "schedule"] as const;
/** How the family likes to spend and shop; becomes the Family Policy (lib/policy/family-policy). */
export const HOUSEHOLD_STYLES = ["saving", "balanced", "convenience"] as const;
export type HouseholdStyle = (typeof HOUSEHOLD_STYLES)[number];
export const MERCHANTS = ["shopee", "lazada", "tiktok", "concung", "bibomart", "supermarket"] as const;
export const MERCHANT_LABELS: Record<(typeof MERCHANTS)[number], string> = { shopee: "Shopee", lazada: "Lazada", tiktok: "TikTok Shop", concung: "Con Cưng", bibomart: "Bibo Mart", supermarket: "Siêu thị / tạp hóa gần nhà" };

/** Household context from onboarding (spec v2 §5 Family Graph): what the family wants help with and how it lives. */
export interface HouseholdContext {
  setup?: (typeof HOUSEHOLD_SETUPS)[number];
  /** Tiết kiệm / Cân bằng / Tiện lợi (onboarding) → Family Policy. */
  style?: HouseholdStyle;
  /** What the family asked FamAgent to help with first; orders Home and suggestions. */
  focus?: Array<(typeof HOUSEHOLD_FOCUS)[number]>;
  /** Rough monthly household spend (VND); seeds the Money plan until the family sets one. */
  monthlySpend?: number;
  /** Where the family usually buys for the kids. */
  merchants?: Array<(typeof MERCHANTS)[number]>;
  housing?: (typeof HOUSING_TYPES)[number];
  /** Rough monthly household income (VND). */
  monthlyIncome?: number;
  /** What the family is saving for. */
  savingGoals?: Array<(typeof SAVING_GOALS)[number]>;
  /** Onboarding insight questions that drive the first assessment. */
  careWorries?: Array<(typeof CARE_WORRIES)[number]>;
  moneyPains?: Array<(typeof MONEY_PAINS)[number]>;
  tracking?: (typeof TRACKING_METHODS)[number];
  /** Monthly loan / instalment payments (VND); 0 = none. */
  monthlyDebt?: number;
  emergency?: (typeof EMERGENCY_LEVELS)[number];
  /** true = the family opted into the deep financial check questions. */
  deepDive?: boolean;
  incomeStability?: (typeof INCOME_STABILITY)[number];
  billTimeliness?: (typeof BILL_TIMELINESS)[number];
  debtTypes?: Array<(typeof DEBT_TYPES)[number]>;
  longTermSavings?: Array<(typeof LONG_TERM_SAVINGS)[number]>;
  insurance?: Array<(typeof INSURANCE_TYPES)[number]>;
  planning?: (typeof PLANNING_LEVELS)[number];
  /** true = the family opted into the child care check questions. */
  careDeepDive?: boolean;
  vaccines?: (typeof VACCINE_STATUS)[number];
  checkup?: (typeof CHECKUP_RECENCY)[number];
  nutrition?: (typeof NUTRITION_LEVELS)[number];
  sleepQuality?: (typeof SLEEP_QUALITY)[number];
  playTime?: (typeof PLAY_TIME)[number];
  screenTime?: (typeof SCREEN_TIME)[number];
  reading?: (typeof READING_FREQ)[number];
  safety?: Array<(typeof SAFETY_MEASURES)[number]>;
  /** Parenting approach the family chose. */
  careMethod?: (typeof CARE_METHODS)[number];
  /** Money framework the family chose (after the onboarding assessment or in Tiền). */
  moneyMethod?: (typeof MONEY_METHODS)[number];
  /** Free-text "Khác" answers keyed by question id (≤ 120 chars each). */
  notes?: Record<string, string>;
}

export interface FamilyProfile {
  id: string;
  household?: HouseholdContext;
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

import type { PurchaseDraft } from "../shopping/capture.ts";
import type { Decision } from "../money/decision.ts";

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
  /** “Vừa mua …” turned into a purchase draft; the UI shows the confirmation card. */
  purchaseDraft?: PurchaseDraft;
  /** Set once the draft was confirmed, so reopening the conversation never logs it twice. */
  purchaseSaved?: string;
  /** "Muốn mua robot hút bụi 8 triệu" → financial fit + 3 options (spec §6). */
  decision?: Decision;
  decisionDone?: string;
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
  purchaseDraft?: PurchaseDraft;
  decision?: Decision;
}
