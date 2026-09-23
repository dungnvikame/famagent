import { NextResponse } from "next/server";
import { runOnboardingTurn, type HistoryItem, type PendingConfirmation } from "@/lib/ai/onboarding/agent";
import { allowInMemory, ONBOARDING_LLM_PER_HOUR } from "@/lib/ai/onboarding/rate-limit";
import { isAiConfigured } from "@/lib/ai/llm";
import { validProfile } from "@/lib/experience/validate";
import { saveProfileForUser } from "@/lib/experience/profile-store";
import { authConfigured, authenticated } from "@/lib/supabase/server";

type Body = { message?: unknown; profile?: unknown; history?: unknown; pending?: unknown };

const validHistory = (value: unknown): value is HistoryItem[] => Array.isArray(value) && value.length <= 40 && value.every((item) =>
  item && typeof item === "object" && (item.role === "user" || item.role === "assistant") && typeof item.text === "string" && item.text.length <= 2000 && (item.slot === undefined || (typeof item.slot === "string" && item.slot.length <= 80)));
const validPending = (value: unknown): value is PendingConfirmation[] => Array.isArray(value) && value.length <= 10 && value.every((item) =>
  item && typeof item === "object" && typeof item.path === "string" && item.path.length <= 80 && typeof item.label === "string" && item.label.length <= 200);

/**
 * Decides whether this turn may call the LLM (plan D1/D5): user consent, AI configured,
 * and under the hourly budget. With Supabase the budget is per (anonymous or email) user;
 * visitors without a session fall back to rules instead of getting an error.
 */
async function llmBudget(request: Request, consent: boolean) {
  if (!consent || !isAiConfigured()) return { allowAi: false, auth: null };
  if (!authConfigured()) {
    // Dev/demo only: x-forwarded-for is spoofable and memory is per instance.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    return { allowAi: allowInMemory(`onboarding:${ip}`), auth: null };
  }
  const auth = await authenticated();
  if (!auth) return { allowAi: false, auth: null };
  // Atomic count-and-insert (migration 202609240002); any error → rules, never a 5xx.
  const { data, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: "onboarding", p_limit: ONBOARDING_LLM_PER_HOUR });
  return { allowAi: !error && data === true, auth };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;
  const history = body?.history ?? [];
  const pending = body?.pending ?? [];
  if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 600 || !validProfile(body.profile) || !validHistory(history) || !validPending(pending)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { allowAi, auth } = await llmBudget(request, body.profile.aiConsent);
  const result = await runOnboardingTurn({ message: body.message.trim(), profile: body.profile, history, pending, allowAi });
  // Final guard: the agent only writes validated values, but never persist or return an invalid profile.
  if (!validProfile(result.profile)) return NextResponse.json({ error: "Chưa ghi nhận được câu trả lời. Vui lòng thử lại." }, { status: 422 });
  // Only anonymous (guest) users are saved per turn (plan D5). Email accounts keep /api/me as their single
  // writer so a half-finished onboarding on a new device can never overwrite an existing server profile.
  const signedIn = auth ?? (authConfigured() ? await authenticated() : null);
  if (signedIn?.user.is_anonymous && await saveProfileForUser(signedIn.client, signedIn.user.id, result.profile)) {
    return NextResponse.json({ error: "Chưa lưu được hồ sơ. Vui lòng thử lại." }, { status: 500 });
  }
  return NextResponse.json(result);
}
