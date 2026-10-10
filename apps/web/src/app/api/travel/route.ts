import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { loadTravelState } from "@/lib/travel/store-server";

export const dynamic = "force-dynamic";

/** GET → everything the Travel pages need in one request: trips, itinerary, packing, expenses. */
export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const state = await loadTravelState(auth.client, auth.user.id);
  return state ? NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Không thể tải dữ liệu chuyến đi" }, { status: 500 });
}
