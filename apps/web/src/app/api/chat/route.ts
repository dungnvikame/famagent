import { NextResponse } from "next/server";
import { extractIntent } from "@/lib/ai/intent";
import { mergeContext } from "@/lib/ai/context";
import { explainRecommendations } from "@/lib/ai/recommendation";
import { getProducts } from "@/lib/catalog/repository";
import type { ChatResponse, FamilyProfile, ShoppingIntent } from "@/lib/experience/types";
import { recommend, RANKING_VERSION } from "@/lib/ranking/recommend";
import { authenticated, authConfigured } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { routeWorkspace } from "@/lib/ai/workspace";
import { parseProfileChange } from "@/lib/ai/profile-change";
import { profileFromRow } from "@/lib/experience/profile-mapper";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: string; profile?: FamilyProfile | null; previousIntent?: ShoppingIntent | null; conversationId?: string } | null;
  if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 1000 || (body.profile && !Array.isArray(body.profile.children))) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  let profile = body.profile ?? null;
  let previousIntent = body.previousIntent ?? null;
  let account: { client: SupabaseClient; user: User } | null = null;
  let conversationId: string | null = null;
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    account = auth;
    const { data, error } = await auth.client.from("family_profiles").select("*,children(*)").eq("user_id", auth.user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Không thể tải hồ sơ" }, { status: 500 });
    profile = data ? profileFromRow(data) : null;
    previousIntent = null;
    if (body.conversationId && /^[a-f0-9-]{36}$/i.test(body.conversationId)) {
      const { data: conversation } = await auth.client.from("conversations").select("id").eq("id", body.conversationId).eq("user_id", auth.user.id).maybeSingle();
      if (conversation) {
        conversationId = conversation.id;
        const { data: history } = await auth.client.from("messages").select("metadata").eq("conversation_id", conversation.id).eq("role", "assistant").order("created_at", { ascending: false }).limit(1);
        previousIntent = history?.[0]?.metadata?.intent as ShoppingIntent | null ?? null;
      }
    }
    if (!conversationId) return NextResponse.json({ error: "Cần tạo hội thoại trước khi tư vấn" }, { status: 400 });
    // Atomic count-and-insert (migration 202609240002) so parallel requests cannot exceed the hourly limit.
    const { data: allowed, error: limitError } = await auth.client.rpc("consume_request_quota", { p_endpoint: "chat", p_limit: 60 });
    if (limitError) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: "Bạn đã dùng hết 60 lượt tư vấn trong một giờ. Vui lòng thử lại sau." }, { status: 429 });
  }
  const profileChange = parseProfileChange(body.message, profile);
  if (profileChange) {
    if (account) {
      const { error: familyError } = await account.client.from("family_profiles").update({ max_budget: profileChange.maxBudget ?? null, price_preference: profileChange.pricePreference, field_meta: profileChange.fieldMeta ?? {}, updated_at: profileChange.updatedAt }).eq("user_id", account.user.id);
      if (familyError) return NextResponse.json({ error: "Không thể cập nhật hồ sơ" }, { status: 500 });
      for (const child of profileChange.children) {
        const { error: childError } = await account.client.from("children").update({ current_weight_kg: child.weightKg ?? null, diaper_size: child.diaperSize ?? null, updated_at: profileChange.updatedAt }).eq("id", child.id);
        if (childError) return NextResponse.json({ error: "Không thể cập nhật thông tin bé" }, { status: 500 });
      }
    }
    return NextResponse.json({ text: "Tôi đã cập nhật hồ sơ gia đình và sẽ dùng thông tin mới cho những gợi ý tiếp theo.", view: { kind: "family" }, profile: profileChange, intent: previousIntent ?? { category: null }, recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: RANKING_VERSION, mode: "rules" } satisfies ChatResponse);
  }
  const products = await getProducts();
  const navigation = routeWorkspace(body.message, products);
  if (navigation) return NextResponse.json({ text: navigation.text, view: navigation.view, intent: previousIntent ?? { category: null }, recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: RANKING_VERSION, mode: "rules" } satisfies ChatResponse);
  const { extracted, mode } = await extractIntent(body.message, profile?.aiConsent ?? false);
  const intent = mergeContext(body.message, extracted, profile, previousIntent);
  if (account && conversationId) {
    const { error } = await account.client.from("shopping_intents").insert({ conversation_id: conversationId, intent, extractor_mode: mode });
    if (error) return NextResponse.json({ error: "Không thể lưu yêu cầu" }, { status: 500 });
  }
  const base: ChatResponse = { text: "", intent, recommendations: [], candidateCount: 0, candidateProductIds: [], rankingVersion: RANKING_VERSION, mode };
  if (intent.category === "unsupported") return NextResponse.json({ ...base, text: "Hiện tôi đang hoàn thiện tư vấn bỉm. Các danh mục khác sẽ được mở sau khi dữ liệu sản phẩm được kiểm tra.", choices: ["Tìm bỉm cho bé"] });
  if (!intent.category) return NextResponse.json({ ...base, text: "Bạn đang muốn tìm sản phẩm nào? Hiện tôi có thể giúp chọn bỉm cho bé.", question: "Bạn cần tìm bỉm cho bé phải không?", choices: ["Tìm bỉm cho bé"] });
  if (!intent.weightKg && !intent.diaperSize) return NextResponse.json({ ...base, text: "Để tránh gợi ý bỉm sai cỡ, tôi cần cân nặng hoặc size hiện tại của bé.", question: "Bé hiện nặng khoảng bao nhiêu kg hoặc đang dùng size nào?", choices: ["Bé 10kg", "Size L"] });
  const { candidateCount, candidateProductIds, recommendations } = recommend(products, intent, profile);
  if (account && conversationId) {
    const { data: session, error } = await account.client.from("recommendation_sessions").insert({
      conversation_id: conversationId, user_id: account.user.id, intent, candidate_product_ids: candidateProductIds,
      result_product_ids: recommendations.map((item) => item.product.id), ranking_version: RANKING_VERSION,
    }).select("id").single();
    if (error || !session) return NextResponse.json({ error: "Không thể lưu phiên gợi ý" }, { status: 500 });
    if (recommendations.length) {
      const { error: itemsError } = await account.client.from("recommendation_items").insert(recommendations.map((item, index) => ({
        session_id: session.id, product_id: item.product.id, offer_id: item.offerId, rank: index + 1,
        total_score: item.score, component_scores: item.scores, reasons: item.reasons,
      })));
      if (itemsError) return NextResponse.json({ error: "Không thể lưu kết quả gợi ý" }, { status: 500 });
    }
  }
  if (!recommendations.length) return NextResponse.json({ ...base, text: explainRecommendations(intent, candidateCount, recommendations), candidateCount, candidateProductIds, choices: ["Bỏ giới hạn giá", "Xem tất cả bỉm"] });
  return NextResponse.json({ ...base, text: explainRecommendations(intent, candidateCount, recommendations), recommendations, candidateCount, candidateProductIds });
}
