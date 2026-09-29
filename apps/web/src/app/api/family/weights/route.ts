import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validWeightInput } from "@/lib/family/validate";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
const uuid = /^[a-f0-9-]{36}$/i;

/** GET → every weighing of the family's children (growth chart), oldest first. */
export async function GET() {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const { data, error } = await auth.client.from("child_weights").select("id,child_id,measured_on,weight_kg").eq("user_id", auth.user.id).order("measured_on").limit(2000);
  if (error) return NextResponse.json({ error: "Không thể tải lịch sử cân nặng" }, { status: 500 });
  const weights = (data ?? []).map((row) => ({ id: row.id as string, childId: row.child_id as string, date: String(row.measured_on).slice(0, 10), kg: Number(row.weight_kg) }));
  return NextResponse.json({ weights }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { childId, date, kg } → one weighing; the same day again replaces it. The child must be in the family. */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => null) as unknown;
  if (!validWeightInput(body)) return NextResponse.json({ error: "Cân nặng hoặc ngày không hợp lệ" }, { status: 400 });
  const { data: family } = await auth.client.from("family_profiles").select("id,children(id)").eq("user_id", auth.user.id).maybeSingle();
  const owned = ((family?.children ?? []) as Array<{ id: string }>).some((child) => child.id === body.childId);
  if (!owned) return NextResponse.json({ error: "Không tìm thấy bé" }, { status: 404 });
  const { data, error } = await auth.client.from("child_weights").upsert({ user_id: auth.user.id, child_id: body.childId, measured_on: body.date, weight_kg: Math.round(body.kg * 10) / 10 }, { onConflict: "child_id,measured_on" }).select("id").single();
  return error || !data ? NextResponse.json({ error: "Chưa lưu được cân nặng" }, { status: 500 }) : NextResponse.json({ id: data.id });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !uuid.test(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await auth.client.from("child_weights").delete().eq("id", id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
