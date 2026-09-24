import { NextResponse } from "next/server";
import { chatJson, isAiConfigured, visionProviders } from "@/lib/ai/llm";
import { allowInMemory } from "@/lib/ai/onboarding/rate-limit";
import { todayLocal } from "@/lib/money/parse";
import { loadItems } from "@/lib/shopping/item-store-server";
import { validItem } from "@/lib/shopping/item-validate";
import type { ShoppingItem } from "@/lib/shopping/items";
import { isImageDataUrl, isReceipt, RECEIPT_SCHEMA, RECEIPT_SYSTEM, receiptDrafts, type Receipt } from "@/lib/shopping/receipt";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET → whether this server can read photos (the button stays hidden otherwise). */
export function GET() {
  return NextResponse.json({ available: isAiConfigured() && visionProviders().length > 0 });
}

/** Order photos read per hour per family (vision calls cost more than a chat turn). */
const RECEIPTS_PER_HOUR = 20;

/**
 * POST { image: data URL } → { drafts } read from an order photo. Only with the family's AI consent and a configured
 * provider; the image is sent to the model for this one request and is never stored or logged.
 */
export async function POST(request: Request) {
  if (!isAiConfigured() || !visionProviders().length) return NextResponse.json({ error: "Đọc ảnh cần bật AI có hỗ trợ ảnh trên máy chủ." }, { status: 503 });
  const body = await request.json().catch(() => null) as { image?: unknown; aiConsent?: unknown; items?: unknown } | null;
  if (!isImageDataUrl(body?.image)) return NextResponse.json({ error: "Ảnh không hợp lệ hoặc quá lớn." }, { status: 400 });
  let items: ShoppingItem[] = [];
  if (authConfigured()) {
    const auth = await authenticated();
    if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    const { data: profile } = await auth.client.from("family_profiles").select("ai_consent").eq("user_id", auth.user.id).maybeSingle();
    if (!profile?.ai_consent) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” trong Gia đình để đọc ảnh." }, { status: 403 });
    const { data: allowed, error } = await auth.client.rpc("consume_request_quota", { p_endpoint: "receipt", p_limit: RECEIPTS_PER_HOUR });
    if (error) return NextResponse.json({ error: "Không thể kiểm tra giới hạn sử dụng" }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: `Bạn đã đọc ${RECEIPTS_PER_HOUR} ảnh trong một giờ. Thử lại sau nhé.` }, { status: 429 });
    items = await loadItems(auth.client, auth.user.id) ?? [];
  } else {
    // Demo mode: consent and items come from the browser; budget per IP (dev only).
    if (body?.aiConsent !== true) return NextResponse.json({ error: "Bật “Cho phép FamAgent dùng AI” để đọc ảnh." }, { status: 403 });
    if (!allowInMemory(`receipt:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, Date.now(), RECEIPTS_PER_HOUR)) return NextResponse.json({ error: "Đã hết lượt đọc ảnh trong giờ này." }, { status: 429 });
    items = Array.isArray(body.items) ? body.items.map(validItem).filter((item): item is ShoppingItem => Boolean(item)).slice(0, 300) : [];
  }
  const result = await chatJson<Receipt>({
    name: "receipt_lines",
    system: RECEIPT_SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: "Đọc các dòng hàng trong ảnh này." }, { type: "image_url", image_url: { url: body.image } }] }],
    schema: RECEIPT_SCHEMA,
    validate: isReceipt,
    timeoutMs: 25_000,
    vision: true,
  });
  if (!result) return NextResponse.json({ error: "Chưa đọc được ảnh này. Thử ảnh rõ hơn, hoặc gõ một câu vào ô ghi nhanh." }, { status: 422 });
  const drafts = receiptDrafts(result.data, items, todayLocal());
  return drafts.length ? NextResponse.json({ drafts }) : NextResponse.json({ error: "Không thấy dòng hàng nào có số tiền trong ảnh." }, { status: 422 });
}
