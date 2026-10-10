import { NextResponse } from "next/server";
import { chatJson, isAiConfigured } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { cleanSuggestions, isSuggestReply, SUGGEST_SCHEMA, suggestSystem, validSuggestRequest } from "@/lib/travel/suggest-ai";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET → whether this server can ask the model (the packing dialog then offers the AI pass). */
export function GET() {
  return NextResponse.json({ available: isAiConfigured() });
}

/** One suggestion call counts as one agent turn (shared "chat" hourly quota, same limit as the chat route). */
const TURNS_PER_HOUR = 60;

/**
 * POST SuggestRequest → { items: PackingSuggestion[] }. Only trip facts and item names are sent — children appear
 * as "bé N tháng/tuổi", never by name; no amounts or account data.
 */
export async function POST(request: Request) {
  if (!isAiConfigured()) return NextResponse.json({ error: "Máy chủ chưa bật AI." }, { status: 503 });
  const body = await request.json().catch(() => null) as ({ aiConsent?: unknown } & Record<string, unknown>) | null;
  const input = validSuggestRequest(body);
  if (!input) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data: profile } = await auth.client.from("family_profiles").select("ai_consent").eq("user_id", auth.user.id).maybeSingle();
    if (!profile?.ai_consent) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” trong Gia đình để AI gợi ý thêm đồ." }, { status: 403 });
    const { data: allowed, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: "chat", p_limit: TURNS_PER_HOUR });
    if (error) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: `Đã dùng hết ${TURNS_PER_HOUR} lượt Trợ lý trong một giờ.` }, { status: 429 });
  } else {
    if (body?.aiConsent !== true) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” để AI gợi ý thêm đồ." }, { status: 403 });
    if (!allowInMemory(`travel-suggest:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), TURNS_PER_HOUR)) return NextResponse.json({ error: "Đã hết lượt trong giờ này." }, { status: 429 });
  }
  const result = await chatJson<{ items: unknown[] }>({
    name: "travel_packing",
    system: suggestSystem(input),
    messages: [{ role: "user", content: "Gợi ý các món còn thiếu." }],
    schema: SUGGEST_SCHEMA,
    validate: isSuggestReply,
    timeoutMs: 20_000,
  });
  if (!result) return NextResponse.json({ error: "AI chưa gợi ý được lúc này." }, { status: 502 });
  return NextResponse.json({ items: cleanSuggestions(result.data, input) });
}
