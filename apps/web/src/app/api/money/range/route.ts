import { NextResponse } from "next/server";
import { loadRange } from "@/lib/money/store-server";
import { authenticated } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));

/** GET /api/money/range?from=YYYY-MM-DD&to=YYYY-MM-DD → ledger entries in the range + cash just before it (≤ 400 days). */
export async function GET(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const from = params.get("from"); const to = params.get("to");
  if (!isDate(from) || !isDate(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 400) return NextResponse.json({ error: "Khoảng ngày không hợp lệ (tối đa 400 ngày)." }, { status: 400 });
  const range = await loadRange(auth.client, auth.user.id, from, to);
  if (!range) return NextResponse.json({ error: "Không thể tải sổ thu chi" }, { status: 500 });
  return NextResponse.json({ range }, { headers: { "Cache-Control": "private, no-store" } });
}
