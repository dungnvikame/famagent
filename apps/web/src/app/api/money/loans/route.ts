import { NextResponse } from "next/server";
import { loadLoans } from "@/lib/money/store-server";
import { authenticated } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/money/loans → every borrowing / lending entry, newest first (Nợ tab). */
export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const loans = await loadLoans(auth.client, auth.user.id);
  if (!loans) return NextResponse.json({ error: "Không thể tải các khoản nợ" }, { status: 500 });
  return NextResponse.json({ loans }, { headers: { "Cache-Control": "private, no-store" } });
}
