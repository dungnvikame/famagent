import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const { data, error } = await auth.client.from("saved_products").select("product_id").eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể tải sản phẩm đã lưu" }, { status: 500 }) : NextResponse.json({ ids: data.map((item) => item.product_id) });
}

export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { productId?: string; saved?: boolean } | null;
  if (!body || typeof body.productId !== "string" || body.productId.length > 100 || typeof body.saved !== "boolean") return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  const query = auth.client.from("saved_products");
  const { error } = body.saved ? await query.upsert({ user_id: auth.user.id, product_id: body.productId }) : await query.delete().eq("user_id", auth.user.id).eq("product_id", body.productId);
  return error ? NextResponse.json({ error: "Không thể cập nhật sản phẩm đã lưu" }, { status: 500 }) : NextResponse.json({ ok: true });
}
