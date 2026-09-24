import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { loadShoppingState } from "@/lib/shopping/item-store-server";

export const dynamic = "force-dynamic";

/** GET → everything the Shopping page needs in one request: items, purchases and (phase 2) checks, plan, dismissed. */
export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const state = await loadShoppingState(auth.client, auth.user.id);
  return state ? NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Không thể tải dữ liệu mua sắm" }, { status: 500 });
}
