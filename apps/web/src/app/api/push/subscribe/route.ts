import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Keys = { endpoint: string; p256dh: string; auth: string };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown, min: number, max: number) => typeof value === "string" && value.length >= min && value.length <= max ? value : null;

/** Browser PushSubscription.toJSON() → the three fields we store; endpoints must be https. */
function validSubscription(input: unknown): Keys | null {
  if (!isRecord(input) || !isRecord(input.keys)) return null;
  const endpoint = text(input.endpoint, 10, 1000); const p256dh = text(input.keys.p256dh, 10, 200); const auth = text(input.keys.auth, 8, 100);
  return endpoint && endpoint.startsWith("https://") && p256dh && auth ? { endpoint, p256dh, auth } : null;
}

/** POST { subscription } saves this device for "sắp hết" reminders; DELETE { endpoint } removes it. */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { subscription?: unknown } | null;
  const keys = validSubscription(body?.subscription);
  if (!keys) return NextResponse.json({ error: "Đăng ký thông báo không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from("push_subscriptions").upsert({ user_id: auth.user.id, ...keys }, { onConflict: "user_id,endpoint" });
  return error ? NextResponse.json({ error: "Không thể lưu đăng ký thông báo" }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  const endpoint = text(body?.endpoint, 10, 1000);
  if (!endpoint) return NextResponse.json({ error: "Thiếu endpoint" }, { status: 400 });
  const { error } = await auth.client.from("push_subscriptions").delete().eq("user_id", auth.user.id).eq("endpoint", endpoint);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
