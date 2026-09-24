import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { loadNotes } from "@/lib/notes/store-server";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
const uuid = /^[a-f0-9-]{36}$/i;

export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const notes = await loadNotes(auth.client, auth.user.id);
  return notes ? NextResponse.json({ notes }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Không thể tải ghi chú" }, { status: 500 });
}

/** PATCH { id, status: "confirmed" } → the family vouches for a recorded note. */
export async function PATCH(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (typeof body?.id !== "string" || !uuid.test(body.id) || body.status !== "confirmed") return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from("family_notes").update({ status: "confirmed" }).eq("id", body.id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể cập nhật" }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !uuid.test(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await auth.client.from("family_notes").delete().eq("id", id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
