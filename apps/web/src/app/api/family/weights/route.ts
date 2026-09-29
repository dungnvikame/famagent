import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validMeasureInput } from "@/lib/family/validate";

// Growth measurements (table child_weights: weight and/or height per child per day).
export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
const uuid = /^[a-f0-9-]{36}$/i;
const num = (value: unknown) => value === null || value === undefined ? undefined : Number(value);

/** GET → every measurement of the family's children (growth charts), oldest first. */
export async function GET() {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const { data, error } = await auth.client.from("child_weights").select("id,child_id,measured_on,weight_kg,height_cm").eq("user_id", auth.user.id).order("measured_on").limit(2000);
  if (error) return NextResponse.json({ error: "Không thể tải lịch sử cân đo" }, { status: 500 });
  const weights = (data ?? []).map((row) => ({ id: row.id as string, childId: row.child_id as string, date: String(row.measured_on).slice(0, 10), kg: num(row.weight_kg), cm: num(row.height_cm) }));
  return NextResponse.json({ weights }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * POST { childId, date, kg?, cm? } → that day's measurement; only the fields sent change (weigh in the morning,
 * measure height later the same day). The child must be in the family.
 */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => null) as unknown;
  if (!validMeasureInput(body)) return NextResponse.json({ error: "Cân nặng, chiều cao hoặc ngày không hợp lệ" }, { status: 400 });
  const { data: family } = await auth.client.from("family_profiles").select("id,children(id)").eq("user_id", auth.user.id).maybeSingle();
  const owned = ((family?.children ?? []) as Array<{ id: string }>).some((child) => child.id === body.childId);
  if (!owned) return NextResponse.json({ error: "Không tìm thấy bé" }, { status: 404 });
  const row = { user_id: auth.user.id, child_id: body.childId, measured_on: body.date, ...(body.kg !== undefined && { weight_kg: Math.round(body.kg * 10) / 10 }), ...(body.cm !== undefined && { height_cm: Math.round(body.cm * 10) / 10 }) };
  const { data, error } = await auth.client.from("child_weights").upsert(row, { onConflict: "child_id,measured_on" }).select("id").single();
  return error || !data ? NextResponse.json({ error: "Chưa lưu được" }, { status: 500 }) : NextResponse.json({ id: data.id });
}

/** DELETE ?id=…&field=kg|cm → clears that value; the day's row goes when nothing is left. */
export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const params = new URL(request.url).searchParams;
  const id = params.get("id"), field = params.get("field");
  if (!id || !uuid.test(id) || (field !== "kg" && field !== "cm")) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { data: row } = await auth.client.from("child_weights").select("weight_kg,height_cm").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!row) return NextResponse.json({ ok: true });
  const other = field === "kg" ? row.height_cm : row.weight_kg;
  const { error } = other === null
    ? await auth.client.from("child_weights").delete().eq("id", id).eq("user_id", auth.user.id)
    : await auth.client.from("child_weights").update(field === "kg" ? { weight_kg: null } : { height_cm: null }).eq("id", id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
