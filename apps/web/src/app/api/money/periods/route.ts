import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { confirmPeriod, undoPeriod } from "@/lib/money/store-server";
import { validConfirm } from "@/lib/money/validate";

export const dynamic = "force-dynamic";

/** POST /api/money/periods → answer one period of a fixed item as paid (writes the ledger entry) or skipped; 409 if already answered. */
export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const input = validConfirm(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const outcome = await confirmPeriod(auth.client, auth.user.id, input);
  return outcome.ok ? NextResponse.json({ ok: true, transaction: outcome.transaction }) : NextResponse.json({ error: outcome.error }, { status: outcome.status });
}

/** DELETE /api/money/periods?recurringId=&period=YYYY-MM → undo: removes the ledger entry the answer created and the answer itself. */
export async function DELETE(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const recurringId = params.get("recurringId"); const period = params.get("period");
  if (!recurringId || !/^[a-f0-9-]{36}$/i.test(recurringId) || !period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Thiếu thông tin kỳ" }, { status: 400 });
  const outcome = await undoPeriod(auth.client, auth.user.id, recurringId, period);
  return outcome.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: outcome.error }, { status: outcome.status });
}
