import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validMilestoneInput } from "@/lib/family/validate";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
const uuid = /^[a-f0-9-]{36}$/i;

/** GET → every milestone the family marked for its children. */
export async function GET() {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const { data, error } = await auth.client.from("child_milestones").select("child_id,milestone_id,status,achieved_on").eq("user_id", auth.user.id).limit(2000);
  if (error) return NextResponse.json({ error: "Không thể tải cột mốc" }, { status: 500 });
  const milestones = (data ?? []).map((row) => ({ childId: row.child_id as string, milestoneId: row.milestone_id as string, status: row.status as "done" | "not_yet", ...(row.achieved_on ? { on: String(row.achieved_on).slice(0, 10) } : {}) }));
  return NextResponse.json({ milestones }, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT { childId, milestoneId, status, on? } → marks one milestone ("done" keeps the day). The child must be in the family. */
export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => null) as unknown;
  if (!validMilestoneInput(body)) return NextResponse.json({ error: "Cột mốc không hợp lệ" }, { status: 400 });
  const { data: family } = await auth.client.from("family_profiles").select("id,children(id)").eq("user_id", auth.user.id).maybeSingle();
  if (!((family?.children ?? []) as Array<{ id: string }>).some((child) => child.id === body.childId)) return NextResponse.json({ error: "Không tìm thấy bé" }, { status: 404 });
  const { error } = await auth.client.from("child_milestones").upsert({ user_id: auth.user.id, child_id: body.childId, milestone_id: body.milestoneId, status: body.status, achieved_on: body.status === "done" ? body.on ?? null : null, updated_at: new Date().toISOString() }, { onConflict: "child_id,milestone_id" });
  return error ? NextResponse.json({ error: "Chưa lưu được" }, { status: 500 }) : NextResponse.json({ ok: true });
}

/** DELETE ?childId=…&milestoneId=… → back to "chưa đánh dấu". */
export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const params = new URL(request.url).searchParams;
  const childId = params.get("childId"), milestoneId = params.get("milestoneId");
  if (!childId || !uuid.test(childId) || !milestoneId) return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  const { error } = await auth.client.from("child_milestones").delete().eq("user_id", auth.user.id).eq("child_id", childId).eq("milestone_id", milestoneId);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
