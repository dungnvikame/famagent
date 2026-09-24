import { NextResponse } from "next/server";
import { chatJson, isAiConfigured, visionProviders } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { isMoneyImage, MONEY_IMAGE_SCHEMA, MONEY_IMAGE_SYSTEM } from "@/lib/money/image-read";
import type { ImageLine } from "@/lib/money/quick-add";
import { isImageDataUrl } from "@/lib/shopping/receipt";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET → whether this server can read photos (the photo button stays hidden otherwise). */
export function GET() {
  return NextResponse.json({ available: isAiConfigured() && visionProviders().length > 0 });
}

/** Shares the hourly photo budget with order photos in Mua sắm ("receipt" quota). */
const PHOTOS_PER_HOUR = 20;

/**
 * POST { image: data URL } → { lines } read from a photo of money movements. Needs the family's AI consent and a
 * vision provider; the image goes to the model for this one request and is never stored or logged.
 */
export async function POST(request: Request) {
  if (!isAiConfigured() || !visionProviders().length) return NextResponse.json({ error: "Đọc ảnh cần bật AI có hỗ trợ ảnh trên máy chủ." }, { status: 503 });
  const body = await request.json().catch(() => null) as { image?: unknown; aiConsent?: unknown } | null;
  if (!isImageDataUrl(body?.image)) return NextResponse.json({ error: "Ảnh không hợp lệ hoặc quá lớn." }, { status: 400 });
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data: profile } = await auth.client.from("family_profiles").select("ai_consent").eq("user_id", auth.user.id).maybeSingle();
    if (!profile?.ai_consent) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” trong Gia đình để đọc ảnh." }, { status: 403 });
    const { data: allowed, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: "receipt", p_limit: PHOTOS_PER_HOUR });
    if (error) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: `Bạn đã đọc ${PHOTOS_PER_HOUR} ảnh trong một giờ. Thử lại sau nhé.` }, { status: 429 });
  } else {
    // Demo mode: consent comes from the browser; budget per IP (dev only).
    if (body?.aiConsent !== true) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” để đọc ảnh." }, { status: 403 });
    if (!allowInMemory(`receipt:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), PHOTOS_PER_HOUR)) return NextResponse.json({ error: "Đã hết lượt đọc ảnh trong giờ này." }, { status: 429 });
  }
  const result = await chatJson<{ lines: ImageLine[] }>({
    name: "money_lines",
    system: MONEY_IMAGE_SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: "Đọc các khoản tiền trong ảnh này." }, { type: "image_url", image_url: { url: body.image } }] }],
    schema: MONEY_IMAGE_SCHEMA,
    validate: isMoneyImage,
    timeoutMs: 25_000,
    vision: true,
  });
  if (!result) return NextResponse.json({ error: "Chưa đọc được ảnh này. Thử ảnh rõ hơn, hoặc dán danh sách dạng chữ." }, { status: 422 });
  return result.data.lines.length ? NextResponse.json({ lines: result.data.lines }) : NextResponse.json({ error: "Không thấy khoản tiền nào trong ảnh." }, { status: 422 });
}
