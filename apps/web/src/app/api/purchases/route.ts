import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { deletePurchase, loadPurchases, recordPurchase, updatePurchaseRate } from "@/lib/shopping/purchase-store-server";
import { validPurchase } from "@/lib/shopping/purchase-validate";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const purchases = await loadPurchases(auth.client, auth.user.id);
  return purchases ? NextResponse.json({ purchases }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Không thể tải lịch sử mua" }, { status: 500 });
}

/** POST { purchase, forChild } → PURCHASE_COMPLETED: purchase + ledger expense + event. */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { purchase?: unknown; forChild?: unknown } | null;
  const purchase = validPurchase(body?.purchase);
  if (!purchase) return NextResponse.json({ error: "Thông tin mua không hợp lệ" }, { status: 400 });
  const result = await recordPurchase(auth.client, auth.user.id, purchase, body?.forChild !== false);
  if (typeof result === "string") return NextResponse.json({ error: result === "transaction" ? "Không thể ghi vào sổ thu chi" : "Không thể lưu lần mua" }, { status: 500 });
  return NextResponse.json({ purchase: result });
}

/** PATCH { id, dailyRate } → consumption rate for that product line. */
export async function PATCH(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { id?: unknown; dailyRate?: unknown } | null;
  const rate = body?.dailyRate === null ? null : Number(body?.dailyRate);
  if (typeof body?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.id) || (rate !== null && !(rate > 0 && rate <= 100))) return NextResponse.json({ error: "Mức dùng không hợp lệ" }, { status: 400 });
  return await updatePurchaseRate(auth.client, auth.user.id, body.id, rate) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể cập nhật" }, { status: 500 });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  return await deletePurchase(auth.client, auth.user.id, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể xóa" }, { status: 500 });
}
