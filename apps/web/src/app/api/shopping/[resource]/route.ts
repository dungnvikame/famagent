import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { deleteItem, SHOPPING_RESOURCES, type ShoppingResource } from "@/lib/shopping/item-store-server";
import { isUuid } from "@/lib/shopping/item-validate";

export const dynamic = "force-dynamic";

const resourceOf = (value: string): ShoppingResource | null => Object.hasOwn(SHOPPING_RESOURCES, value) ? value as ShoppingResource : null;

/** PUT { item } upserts one validated row of the resource (RLS scopes it to the user). */
export async function PUT(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { item?: unknown } | null;
  const handler = SHOPPING_RESOURCES[resource];
  const item = handler.validate(body?.item);
  if (!item) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from(handler.table).upsert(handler.row(item as never, auth.user.id), { onConflict: handler.conflict });
  return error ? NextResponse.json({ error: "Không thể lưu" }, { status: 500 }) : NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isUuid(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const handler: (typeof SHOPPING_RESOURCES)[ShoppingResource] = SHOPPING_RESOURCES[resource];
  if (resource === "items") return await deleteItem(auth.client, auth.user.id, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể xóa" }, { status: 500 });
  const { error } = await auth.client.from(handler.table).delete().eq(handler.idColumn, id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
