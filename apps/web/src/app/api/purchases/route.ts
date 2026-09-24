import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { itemFromRow, saveItem } from "@/lib/shopping/item-store-server";
import { isUuid, validItem } from "@/lib/shopping/item-validate";
import { deletePurchase, loadPurchases, recordPurchase } from "@/lib/shopping/purchase-store-server";
import { validPurchase } from "@/lib/shopping/purchase-validate";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const purchases = await loadPurchases(auth.client, auth.user.id);
  return purchases ? NextResponse.json({ purchases }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Không thể tải lịch sử mua" }, { status: 500 });
}

/**
 * POST { purchase, item?, forChild, linkTransactionId? } → PURCHASE_COMPLETED. `item` (new or updated household item) is
 * saved first so a purchase of anything, from anywhere, has an item to restock; `linkTransactionId` reuses a ledger row.
 */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { purchase?: unknown; item?: unknown; forChild?: unknown; linkTransactionId?: unknown } | null;
  const purchase = validPurchase(body?.purchase);
  const item = body?.item === undefined ? null : validItem(body.item);
  if (!purchase || (body?.item !== undefined && !item) || (body?.linkTransactionId !== undefined && !isUuid(body.linkTransactionId))) return NextResponse.json({ error: "Thông tin mua không hợp lệ" }, { status: 400 });
  if (item) {
    // A card may hold a stale copy of an existing item: keep the stored name/status/rate, only fill what it lacks.
    const { data: row } = await auth.client.from("shopping_items").select("*").eq("id", item.id).eq("user_id", auth.user.id).maybeSingle();
    const stored = row ? itemFromRow(row) : null;
    const merged = stored ? { ...stored, packSize: stored.packSize ?? item.packSize, merchant: item.merchant ?? stored.merchant, productId: stored.productId ?? item.productId, brand: stored.brand ?? item.brand } : item;
    if (!await saveItem(auth.client, auth.user.id, merged)) return NextResponse.json({ error: "Không thể lưu món đồ" }, { status: 500 });
    purchase.itemId = item.id;
  } else if (purchase.itemId) {
    const { data } = await auth.client.from("shopping_items").select("id").eq("id", purchase.itemId).eq("user_id", auth.user.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Không tìm thấy món đồ" }, { status: 400 });
  } else return NextResponse.json({ error: "Thiếu món đồ" }, { status: 400 });
  const link = typeof body?.linkTransactionId === "string" ? body.linkTransactionId : undefined;
  // "ledger" means the expense already existed; without a link the purchase created its own expense.
  if (link) purchase.source = "ledger"; else if (purchase.source === "ledger") purchase.source = "quick";
  const result = await recordPurchase(auth.client, auth.user.id, purchase, body?.forChild !== false, link);
  if (result === "linked") return NextResponse.json({ error: "Khoản chi này không gắn được (đã gắn hoặc không phải khoản chi)" }, { status: 409 });
  if (typeof result === "string") return NextResponse.json({ error: result === "transaction" ? "Không thể ghi vào sổ thu chi" : "Không thể lưu lần mua" }, { status: 500 });
  return NextResponse.json({ purchase: result, item });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isUuid(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  return await deletePurchase(auth.client, auth.user.id, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể xóa" }, { status: 500 });
}
