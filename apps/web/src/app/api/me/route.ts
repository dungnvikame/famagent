import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validProfile } from "@/lib/experience/validate";
import { profileFromRow } from "@/lib/experience/profile-mapper";
import { saveProfileForUser, type SaveProfileError } from "@/lib/experience/profile-store";

export const dynamic = "force-dynamic";

const saveErrors: Record<SaveProfileError, string> = { family: "Không thể lưu hồ sơ", children_read: "Không thể tải thông tin bé", children_write: "Không thể lưu thông tin bé", children_delete: "Không thể cập nhật danh sách bé" };

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const { data, error } = await auth.client.from("family_profiles").select("*,children(*)").eq("user_id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Không thể tải hồ sơ" }, { status: 500 });
  if (!data) return NextResponse.json({ profile: null });
  const profile = profileFromRow(data);
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { profile?: unknown } | null;
  if (!validProfile(body?.profile)) return NextResponse.json({ error: "Hồ sơ không hợp lệ" }, { status: 400 });
  const profile = body.profile;
  const failed = await saveProfileForUser(auth.client, auth.user.id, profile);
  if (failed) return NextResponse.json({ error: saveErrors[failed] }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const client = auth.client;
  const userId = auth.user.id;
  const { error: savedError } = await client.from("saved_products").delete().eq("user_id", userId);
  const { error: logsError } = await client.from("recommendation_sessions").delete().eq("user_id", userId);
  const { error: analyticsError } = await client.from("analytics_events").delete().eq("user_id", userId);
  const { error: clicksError } = await client.from("affiliate_clicks").delete().eq("user_id", userId);
  const { error: conversationsError } = await client.from("conversations").delete().eq("user_id", userId);
  const moneyErrors = await Promise.all(["purchases", "family_events", "money_transactions", "money_budgets", "money_recurring", "money_goals", "money_settings"].map(async (table) => (await client.from(table).delete().eq("user_id", userId)).error));
  const { error: familyError } = await client.from("family_profiles").delete().eq("user_id", userId);
  if (savedError || logsError || analyticsError || clicksError || conversationsError || familyError || moneyErrors.some(Boolean)) return NextResponse.json({ error: "Chưa thể xóa toàn bộ dữ liệu" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
