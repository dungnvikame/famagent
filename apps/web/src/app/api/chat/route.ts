import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/llm";
import { upgradeIntent } from "@/lib/ai/shopping/context-merger";
import { emptyIntent, runShoppingTurn } from "@/lib/ai/shopping/pipeline";
import { answerMoney, detectMoneyQuestion } from "@/lib/money/answer";
import { loadBundle } from "@/lib/money/store-server";
import { monthKey, summarizeMonth } from "@/lib/money/summary";
import { getProducts } from "@/lib/catalog/repository";
import { persistShoppingTurn, type PersistError } from "@/lib/experience/chat-persistence";
import { profileFromRow } from "@/lib/experience/profile-mapper";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { validProfile } from "@/lib/experience/validate";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "@/lib/experience/types";
import { authenticated, authConfigured } from "@/lib/supabase/server";

const persistErrors: Record<PersistError, string> = { profile: "Không thể cập nhật hồ sơ", children: "Không thể cập nhật thông tin bé", intent: "Không thể lưu yêu cầu", session: "Không thể lưu phiên gợi ý", items: "Không thể lưu kết quả gợi ý", trace: "Không thể lưu nhật ký" };

// Thin route: auth + rate limit → shopping pipeline (lib/ai/shopping) → persistence.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: unknown; profile?: unknown; previousIntent?: unknown; conversationId?: unknown } | null;
  if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 1000) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  // Local mode: profile and previous intent come from the browser; anything invalid is ignored, not fatal.
  let profile = validProfile(body.profile) ? body.profile as FamilyProfile : null;
  let previousIntent: ShoppingIntent | null = upgradeIntent(body.previousIntent);
  let account: Awaited<ReturnType<typeof authenticated>> = null;
  let conversationId: string | null = null;
  if (authConfigured()) {
    account = await authenticated();
    if (!account) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data, error } = await account.client.from("family_profiles").select("*,children(*)").eq("user_id", account.user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Không thể tải hồ sơ" }, { status: 500 });
    profile = data ? profileFromRow(data) : null;
    previousIntent = null;
    if (typeof body.conversationId === "string" && /^[a-f0-9-]{36}$/i.test(body.conversationId)) {
      const { data: conversation } = await account.client.from("conversations").select("id").eq("id", body.conversationId).eq("user_id", account.user.id).maybeSingle();
      if (conversation) {
        conversationId = conversation.id;
        const { data: history } = await account.client.from("messages").select("metadata").eq("conversation_id", conversation.id).eq("role", "assistant").order("created_at", { ascending: false }).limit(1);
        previousIntent = upgradeIntent(history?.[0]?.metadata?.intent);
      }
    }
    if (!conversationId) return NextResponse.json({ error: "Cần tạo hội thoại trước khi tư vấn" }, { status: 400 });
    // Atomic count-and-insert (migration 202609240002) so parallel requests cannot exceed the hourly limit.
    const { data: allowed, error: limitError } = await account.client.rpc("consume_request_quota", { p_endpoint: "chat", p_limit: 60 });
    if (limitError) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: "Bạn đã dùng hết 60 lượt tư vấn trong một giờ. Vui lòng thử lại sau." }, { status: 429 });
  }

  // Family Coordinator (spec v2 §18): finance questions are answered from the ledger by rules, no LLM.
  const moneyQuestion = detectMoneyQuestion(body.message);
  if (moneyQuestion && account) {
    const bundle = await loadBundle(account.client, account.user.id, monthKey(new Date()));
    if (!bundle) return NextResponse.json({ error: "Không thể tải sổ thu chi" }, { status: 500 });
    const answer = answerMoney(moneyQuestion, summarizeMonth(bundle), body.message);
    const response: ChatResponse = { ...answer, intent: previousIntent ?? emptyIntent(), recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: "money-rules-v1", mode: "rules" };
    return NextResponse.json(response);
  }

  // Local/demo mode has no user id: budget AI turns per IP (dev only; x-forwarded-for is spoofable).
  // Short-circuit so the counter only moves when an AI call would actually be made.
  const allowAi = Boolean(profile?.aiConsent) && isAiConfigured() && (Boolean(account) || allowInMemory(`chat:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), 60));
  const products = await getProducts();
  const result = await runShoppingTurn({ message: body.message.trim(), profile, previousIntent, products, allowAi });

  if (account && conversationId) {
    const failed = await persistShoppingTurn(account.client, account.user.id, conversationId, result);
    if (failed) return NextResponse.json({ error: persistErrors[failed] }, { status: 500 });
  }
  return NextResponse.json(result.response);
}
