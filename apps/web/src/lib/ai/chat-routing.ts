// Routing order of /api/chat as a pure function, so it can be tested without the route's auth and database:
// purchase log → money Q&A → money plan edit → profile edit → workspace navigation → shopping pipeline.
// Only the last one may call an LLM, so only that route consumes the hourly AI quota.
import type { Product } from "../catalog/types.ts";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "../experience/types.ts";
import { detectMoneyPeriod, detectMoneyQuestion, isMoneyPlanEdit, type MoneyPeriod, type MoneyQuestion } from "../money/answer.ts";
import { looksLikePurchaseLog } from "../shopping/capture.ts";
import { parseProfileChange } from "./profile-change.ts";
import { emptyIntent } from "./shopping/pipeline.ts";
import { routeWorkspace } from "./workspace.ts";

export type ChatRoute =
  | { kind: "purchase-log" }
  | { kind: "money-question"; question: MoneyQuestion; period: MoneyPeriod }
  | { kind: "money-plan-edit" }
  | { kind: "profile-edit" }
  | { kind: "navigate" }
  | { kind: "shopping" };

export interface RouteContext {
  profile: FamilyProfile | null;
  products: Product[];
  /** Money answers need the signed-in ledger; in demo mode the browser answers them before calling the API. */
  moneyAvailable: boolean;
}

export function routeChat(message: string, context: RouteContext): ChatRoute {
  if (looksLikePurchaseLog(message)) return { kind: "purchase-log" };
  if (context.moneyAvailable) {
    const question = detectMoneyQuestion(message);
    if (question) return { kind: "money-question", question, period: detectMoneyPeriod(message) };
  }
  if (isMoneyPlanEdit(message)) return { kind: "money-plan-edit" };
  if (parseProfileChange(message, context.profile)) return { kind: "profile-edit" };
  if (routeWorkspace(message, context.products)) return { kind: "navigate" };
  return { kind: "shopping" };
}

/** Chat AI turns per user per hour (consume_request_quota). */
export const CHAT_AI_PER_HOUR = 60;
export const QUOTA_NOTICE = `Bạn đã dùng hết ${CHAT_AI_PER_HOUR} lượt tư vấn AI trong một giờ nên lượt này mình trả lời bằng quy tắc, không dùng AI.`;

/** Whether a route can reach the LLM (extract / compose); every other route is rules only and costs no quota. */
export const usesLlm = (route: ChatRoute) => route.kind === "shopping";

export type QuotaResult = "allowed" | "exceeded" | "unavailable";

/**
 * Decides whether this turn may use the LLM. The quota is consumed only for a turn that could call it; when it is
 * used up (or cannot be checked) the turn still gets a normal reply from the rules, with a notice when exceeded.
 */
export async function resolveAiUse(route: ChatRoute, aiEnabled: boolean, consume: () => Promise<QuotaResult>): Promise<{ allowAi: boolean; notice?: string }> {
  if (!aiEnabled || !usesLlm(route)) return { allowAi: false };
  const result = await consume();
  return result === "allowed" ? { allowAi: true } : result === "exceeded" ? { allowAi: false, notice: QUOTA_NOTICE } : { allowAi: false };
}

/**
 * The intent a rules-only turn (purchase draft, money answer) hands back to the client. It keeps the shopping
 * context but drops `pendingQuestion`: a later bare "ok" must not answer an old shopping question.
 */
export function intentWithoutPending(previous: ShoppingIntent | null): ShoppingIntent {
  return { ...emptyIntent(previous), pendingQuestion: undefined };
}

/** A rules-only reply outside the shopping pipeline. */
export function rulesReply(reply: { text: string; choices?: string[] }, previousIntent: ShoppingIntent | null, rankingVersion: string, extra: Partial<ChatResponse> = {}): ChatResponse {
  return { ...reply, intent: intentWithoutPending(previousIntent), recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion, mode: "rules", ...extra };
}
