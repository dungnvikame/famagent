export const PRICE_PREFERENCES = ["budget", "value", "balanced", "premium"] as const;
export const SHOPPING_CONCERNS = ["night", "leak", "soft", "sensitive", "value"] as const;
export const DELIVERY_PREFERENCES = ["cheapest", "fastest", "balanced"] as const;
export const SENSITIVITIES = ["sensitive_skin", "rash_prone", "fragrance_free"] as const;
export const WASHING_MACHINES = ["front", "top", "none"] as const;
export const DIAPER_SIZES = ["NB", "S", "M", "L", "XL", "XXL"] as const;
/** Only for the WHO growth curves (they differ for boys and girls). */
export const CHILD_SEXES = ["male", "female"] as const;
export const FIELD_SOURCES = ["user_entered", "user_confirmed"] as const;

export type PricePreference = (typeof PRICE_PREFERENCES)[number];
export const PRICE_PREFERENCE_LABELS: Record<PricePreference, string> = { budget: "Giá thấp nhất", value: "Giá trị tốt nhất", balanced: "Cân bằng", premium: "Cao cấp" };
export type ShoppingConcern = (typeof SHOPPING_CONCERNS)[number];
export const SHOPPING_CONCERN_LABELS: Record<ShoppingConcern, string> = { night: "dùng ban đêm", leak: "hạn chế tràn", soft: "mỏng nhẹ", sensitive: "da nhạy cảm", value: "giá theo đơn vị" };
export type DeliveryPreference = (typeof DELIVERY_PREFERENCES)[number];
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
  sex?: (typeof CHILD_SEXES)[number];
  /** YYYY-MM-DD; preferred over ageMonths when both exist. */
  birthDate?: string;
  weightKg?: number;
  ageMonths?: number;
  /** YYYY-MM-DD `ageMonths` was true on; the age then grows by the months elapsed since. Absent = ageMonths is taken as is. */
  ageAsOf?: string;
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
export const MONEY_METHODS = ["jars", "50-30-20", "pay-first", "zero-based", "kakeibo", "baby-steps", "custom"] as const;
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
/** Family page: adult roles, avatar colours and cover themes (lib/family/members). */
export const MEMBER_ROLES = ["dad", "mom", "grandpa", "grandma", "caregiver", "other"] as const;
export const AVATAR_COLORS = ["sunset", "peach", "lilac", "ocean", "mint", "rose", "sky", "ink"] as const;
/** How often to remind weighing / measuring the children (lib/family/measure-schedule). */
export const MEASURE_EVERY = ["auto", "monthly", "bimonthly", "quarterly", "halfyear", "off"] as const;
export const COVER_THEMES = ["aurora", "sunrise", "garden", "ocean", "night"] as const;
/** An adult of the household; `id` "me" = the signed-in account. */
export interface AdultMember { id: string; name?: string; role?: (typeof MEMBER_ROLES)[number]; emoji?: string; color?: (typeof AVATAR_COLORS)[number] }
/** How a member is drawn when there is no photo. */
export interface MemberLook { emoji?: string; color?: (typeof AVATAR_COLORS)[number] }
export const MERCHANTS = ["shopee", "lazada", "tiktok", "concung", "bibomart", "supermarket"] as const;

/** Household context from onboarding (spec v2 §5 Family Graph): what the family wants help with and how it lives. */
export interface HouseholdContext {
  setup?: (typeof HOUSEHOLD_SETUPS)[number];
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
  /** Family page: adults of the household (adultsCount follows its length), looks of the children keyed by child id, motto and cover. */
  members?: AdultMember[];
  looks?: Record<string, MemberLook>;
  motto?: string;
  theme?: (typeof COVER_THEMES)[number];
  measureEvery?: (typeof MEASURE_EVERY)[number];
  /** false = no 8:00 "Mẹo hôm nay" push (on by default for families with notifications). */
  tipPush?: boolean;
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
