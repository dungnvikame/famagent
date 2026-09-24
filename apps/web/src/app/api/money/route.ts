import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { loadBundle, settingsRow } from "@/lib/money/store-server";
import { monthKey } from "@/lib/money/summary";
import { validSettings } from "@/lib/money/validate";

export const dynamic = "force-dynamic";

/** GET /api/money?month=YYYY-MM → the whole month bundle (posts due recurring items first). */
export async function GET(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const wanted = new URL(request.url).searchParams.get("month");
  const month = wanted && /^\d{4}-(0[1-9]|1[0-2])$/.test(wanted) ? wanted : monthKey(new Date());
  const bundle = await loadBundle(auth.client, auth.user.id, month);
  if (!bundle) return NextResponse.json({ error: "Không thể tải sổ thu chi" }, { status: 500 });
  return NextResponse.json({ bundle }, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT /api/money → settings (opening balances, plan, categories). */
export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { settings?: unknown } | null;
  const settings = validSettings(body?.settings);
  if (!settings) return NextResponse.json({ error: "Thiết lập không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from("money_settings").upsert(settingsRow(settings, auth.user.id), { onConflict: "user_id" });
  return error ? NextResponse.json({ error: "Không thể lưu thiết lập" }, { status: 500 }) : NextResponse.json({ ok: true });
}
