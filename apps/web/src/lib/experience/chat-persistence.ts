// Server-side persistence for a shopping turn (signed-in users only): intent, recommendation
// session with rejection reasons, ranked items, and the agent trace. Keeps the chat route thin.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingTurnResult } from "../ai/shopping/pipeline.ts";
import { RANKING_VERSION } from "../ranking/recommend.ts";

export type PersistError = "profile" | "children" | "intent" | "session" | "items" | "trace";

export async function persistShoppingTurn(client: SupabaseClient, userId: string, conversationId: string, result: ShoppingTurnResult): Promise<PersistError | null> {
  const { response } = result;
  if (result.profileChange) {
    const change = result.profileChange;
    const { error: familyError } = await client.from("family_profiles").update({ max_budget: change.maxBudget ?? null, price_preference: change.pricePreference, field_meta: change.fieldMeta ?? {}, updated_at: change.updatedAt }).eq("user_id", userId);
    if (familyError) return "profile";
    for (const child of change.children) {
      const { error: childError } = await client.from("children").update({ current_weight_kg: child.weightKg ?? null, diaper_size: child.diaperSize ?? null, updated_at: change.updatedAt }).eq("id", child.id);
      if (childError) return "children";
    }
  }
  const parsed = result.trace.some((step) => step.state === "CONTEXT_RESOLVED");
  if (parsed) {
    const { error } = await client.from("shopping_intents").insert({ conversation_id: conversationId, intent: response.intent, extractor_mode: response.mode });
    if (error) return "intent";
  }
  if (result.rejected) {
    const { data: session, error } = await client.from("recommendation_sessions").insert({
      conversation_id: conversationId, user_id: userId, intent: response.intent, candidate_product_ids: response.candidateProductIds,
      result_product_ids: response.recommendations.map((item) => item.product.id), ranking_version: RANKING_VERSION,
      rejected_products: result.rejected,
    }).select("id").single();
    if (error || !session) return "session";
    if (response.recommendations.length) {
      const { error: itemsError } = await client.from("recommendation_items").insert(response.recommendations.map((item) => ({
        session_id: session.id, product_id: item.product.id, offer_id: item.offerId, rank: item.rank, total_score: item.score,
        component_scores: item.scores, reasons: { matched: item.reasons, tradeoffs: item.tradeoffs, failedSoftPreferences: item.failedSoftPreferences, evidenceRefs: item.evidenceRefs },
        score_version: item.scoreVersion,
      })));
      if (itemsError) return "items";
    }
  }
  // Trace is observability, not business data: a failed write must not fail the user's turn.
  const { error: traceError } = await client.from("agent_runs").insert({ user_id: userId, conversation_id: conversationId, final_state: result.finalState, algorithm_version: RANKING_VERSION, extractor_mode: response.mode, steps: result.trace });
  if (traceError) console.warn("[agent_runs]", JSON.stringify({ code: traceError.code ?? "unknown" }));
  return null;
}
