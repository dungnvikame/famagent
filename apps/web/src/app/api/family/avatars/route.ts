import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validAvatarImage, validMemberId } from "@/lib/family/validate";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

/** GET → { avatars: { [memberId]: dataUrl } } for the family's photos. */
export async function GET() {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const { data, error } = await auth.client.from("member_avatars").select("member_id,image").eq("user_id", auth.user.id).limit(20);
  if (error) return NextResponse.json({ error: "Không thể tải ảnh đại diện" }, { status: 500 });
  const avatars = Object.fromEntries((data ?? []).map((row) => [row.member_id as string, row.image as string]));
  return NextResponse.json({ avatars }, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT { memberId, image } → the member's photo (a small square JPEG data URL made in the browser). */
export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => null) as { memberId?: unknown; image?: unknown } | null;
  if (!validMemberId(body?.memberId) || !validAvatarImage(body?.image)) return NextResponse.json({ error: "Ảnh không hợp lệ hoặc quá lớn" }, { status: 400 });
  const { error } = await auth.client.from("member_avatars").upsert({ user_id: auth.user.id, member_id: body.memberId, image: body.image, updated_at: new Date().toISOString() }, { onConflict: "user_id,member_id" });
  return error ? NextResponse.json({ error: "Chưa lưu được ảnh" }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth) return unauthorized();
  const memberId = new URL(request.url).searchParams.get("memberId");
  if (!validMemberId(memberId)) return NextResponse.json({ error: "Thiếu thành viên" }, { status: 400 });
  const { error } = await auth.client.from("member_avatars").delete().eq("user_id", auth.user.id).eq("member_id", memberId);
  return error ? NextResponse.json({ error: "Không thể xóa ảnh" }, { status: 500 }) : NextResponse.json({ ok: true });
}
