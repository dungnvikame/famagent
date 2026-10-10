import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { deleteTripExpense, recordTripExpense } from "@/lib/travel/expense-store-server";
import { deleteTrip, TRAVEL_RESOURCES, type TravelResource } from "@/lib/travel/store-server";
import { isUuid, validExpense } from "@/lib/travel/validate";

export const dynamic = "force-dynamic";

const resourceOf = (value: string): TravelResource | null => Object.hasOwn(TRAVEL_RESOURCES, value) ? value as TravelResource : null;

/** PUT { item } upserts one validated row of the resource (RLS scopes it to the user). */
export async function PUT(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { item?: unknown } | null;
  // An expense also mirrors into the money ledger — one source of truth, idempotent on the expense id.
  if (resource === "expenses") {
    const expense = validExpense(body?.item);
    if (!expense) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    const { data: trip } = await auth.client.from("travel_trips").select("name").eq("id", expense.tripId).eq("user_id", auth.user.id).maybeSingle();
    if (!trip) return NextResponse.json({ error: "Không tìm thấy chuyến đi" }, { status: 404 });
    const stored = await recordTripExpense(auth.client, auth.user.id, expense, trip.name as string);
    return typeof stored === "string" ? NextResponse.json({ error: "Không thể lưu" }, { status: 500 }) : NextResponse.json({ ok: true, item: stored });
  }
  const handler = TRAVEL_RESOURCES[resource];
  const item = handler.validate(body?.item);
  if (!item) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from(handler.table).upsert(handler.row(item as never, auth.user.id), { onConflict: handler.conflict });
  return error ? NextResponse.json({ error: "Không thể lưu" }, { status: 500 }) : NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isUuid(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  if (resource === "trips") return await deleteTrip(auth.client, auth.user.id, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể xóa" }, { status: 500 });
  if (resource === "expenses") return await deleteTripExpense(auth.client, auth.user.id, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Không thể xóa" }, { status: 500 });
  const handler = TRAVEL_RESOURCES[resource];
  const { error } = await auth.client.from(handler.table).delete().eq(handler.idColumn, id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
