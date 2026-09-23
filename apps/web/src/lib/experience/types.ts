import type { Product } from "@/lib/catalog/types";

export type PricePreference = "budget" | "balanced" | "premium";
export type ShoppingConcern = "night" | "leak" | "soft" | "sensitive" | "value";

export interface ChildProfile {
  id: string;
  name?: string;
  weightKg?: number;
  ageMonths?: number;
  diaperSize?: string;
}

export interface FamilyProfile {
  id: string;
  familyName?: string;
  children: ChildProfile[];
  pricePreference: PricePreference;
  mainConcern?: ShoppingConcern;
  maxBudget?: number;
  aiConsent: boolean;
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
