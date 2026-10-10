import { NextResponse } from "next/server";
import { chatJson, isAiConfigured, visionProviders, type ContentPart } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { isImageDataUrl } from "@/lib/shopping/receipt";
import { cleanImport, IMPORT_SCHEMA, importSystem, isImportReply, validImportRequest } from "@/lib/travel/import-ai";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET → whether the import sheet can offer text and photo input. */
export function GET() {
  return NextResponse.json({ available: isAiConfigured(), vision: isAiConfigured() && visionProviders().length > 0 });
}

/** Text parses share the chat quota; a photo costs a slot of the hourly photo budget, like money/read-image. */
const TURNS_PER_HOUR = 60;
const PHOTOS_PER_HOUR = 20;

/**
 * POST { destination, days, text?, image?, existingPacking? } → { itinerary, packing } parsed from a tour
 * programme. The image goes to the model for this one request and is never stored or logged.
 */
export async function POST(request: Request) {
  if (!isAiConfigured()) return NextResponse.json({ error: "Máy chủ chưa bật AI." }, { status: 503 });
  const body = await request.json().catch(() => null) as ({ aiConsent?: unknown; existingPacking?: unknown } & Record<string, unknown>) | null;
  const input = validImportRequest(body);
  if (!input) return NextResponse.json({ error: "Dán lịch trình hoặc chọn ảnh trước đã." }, { status: 400 });
  if (input.image && !isImageDataUrl(input.image)) return NextResponse.json({ error: "Ảnh không hợp lệ hoặc quá lớn." }, { status: 400 });
  if (input.image && !visionProviders().length) return NextResponse.json({ error: "Máy chủ chưa hỗ trợ đọc ảnh — dán nội dung dạng chữ nhé." }, { status: 503 });
  const quota = input.image ? { endpoint: "receipt", limit: PHOTOS_PER_HOUR } : { endpoint: "chat", limit: TURNS_PER_HOUR };
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data: profile } = await auth.client.from("family_profiles").select("ai_consent").eq("user_id", auth.user.id).maybeSingle();
    if (!profile?.ai_consent) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” trong Gia đình để đọc lịch trình." }, { status: 403 });
    const { data: allowed, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: quota.endpoint, p_limit: quota.limit });
    if (error) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: "Đã hết lượt trong giờ này. Thử lại sau nhé." }, { status: 429 });
  } else {
    if (body?.aiConsent !== true) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” để đọc lịch trình." }, { status: 403 });
    if (!allowInMemory(`travel-import:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), quota.limit)) return NextResponse.json({ error: "Đã hết lượt trong giờ này." }, { status: 429 });
  }
  const parts: ContentPart[] = [{ type: "text", text: input.text ? input.text : "Đọc lịch trình trong ảnh này." }];
  if (input.image) parts.push({ type: "image_url", image_url: { url: input.image } });
  const result = await chatJson<{ itinerary: unknown[]; packing: unknown[] }>({
    name: "travel_import",
    system: importSystem(input),
    messages: [{ role: "user", content: input.image ? parts : input.text! }],
    schema: IMPORT_SCHEMA,
    validate: isImportReply,
    timeoutMs: 25_000,
    vision: Boolean(input.image),
  });
  if (!result) return NextResponse.json({ error: "Chưa đọc được lịch trình này. Thử dán phần chương trình theo ngày, hoặc ảnh rõ hơn." }, { status: 422 });
  const existingPacking = Array.isArray(body?.existingPacking) ? (body!.existingPacking as unknown[]).filter((name): name is string => typeof name === "string").slice(0, 200) : [];
  const parsed = cleanImport(result.data, input, existingPacking);
  return parsed.itinerary.length || parsed.packing.length
    ? NextResponse.json(parsed)
    : NextResponse.json({ error: "Không thấy hoạt động hay món đồ nào trong nội dung." }, { status: 422 });
}
