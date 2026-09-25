import { NextResponse } from "next/server";
import { chatJson, isAiConfigured } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { CLASSIFY_SCHEMA, classifySystem, cleanAnswers, isClassifyReply, validClassifyRequest } from "@/lib/money/classify-ai";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET → whether this server can ask the model (quick add then offers the second pass). */
export function GET() {
  return NextResponse.json({ available: isAiConfigured() });
}

/** One classify call counts as one agent turn (shared "chat" hourly quota, same limit as the chat route). */
const TURNS_PER_HOUR = 60;

/**
 * POST { lines: [{ i, content, kind }], categories, children } → { items: [{ i, kind, category }] }.
 * Only line text and category names are sent to the model — no amounts, dates or account data.
 */
export async function POST(request: Request) {
  if (!isAiConfigured()) return NextResponse.json({ error: "Máy chủ chưa bật AI." }, { status: 503 });
  const body = await request.json().catch(() => null) as ({ aiConsent?: unknown } & Record<string, unknown>) | null;
  const input = validClassifyRequest(body);
  if (!input) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data: profile } = await auth.client.from("family_profiles").select("ai_consent").eq("user_id", auth.user.id).maybeSingle();
    if (!profile?.ai_consent) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” trong Gia đình để Trợ lý AI xếp nhóm." }, { status: 403 });
    const { data: allowed, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: "chat", p_limit: TURNS_PER_HOUR });
    if (error) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: `Đã dùng hết ${TURNS_PER_HOUR} lượt Trợ lý trong một giờ.` }, { status: 429 });
  } else {
    if (body?.aiConsent !== true) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” để Trợ lý AI xếp nhóm." }, { status: 403 });
    if (!allowInMemory(`classify:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), TURNS_PER_HOUR)) return NextResponse.json({ error: "Đã hết lượt trong giờ này." }, { status: 429 });
  }
  const result = await chatJson<{ items: unknown[] }>({
    name: "money_categories",
    system: classifySystem(input),
    messages: [{ role: "user", content: JSON.stringify(input.lines) }],
    schema: CLASSIFY_SCHEMA,
    validate: isClassifyReply,
    timeoutMs: 20_000,
  });
  if (!result) return NextResponse.json({ error: "Trợ lý AI chưa xếp được lúc này." }, { status: 502 });
  return NextResponse.json({ items: cleanAnswers(result.data, input) });
}
