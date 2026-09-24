import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { budgetRow, goalRow, recurringRow, TABLES, transactionRow, type MoneyResource } from "@/lib/money/store-server";
import { validBudget, validGoal, validRecurring, validTransaction } from "@/lib/money/validate";

export const dynamic = "force-dynamic";

// One route for the four ledger resources: PUT upserts a validated item, DELETE removes by id (RLS scopes to the user).
const handlers: Record<MoneyResource, { validate: (input: unknown) => object | null; row: (item: never, userId: string) => object; conflict: string }> = {
  transactions: { validate: validTransaction, row: transactionRow as never, conflict: "id" },
  budgets: { validate: validBudget, row: budgetRow as never, conflict: "user_id,category,month" },
  recurring: { validate: validRecurring, row: recurringRow as never, conflict: "id" },
  goals: { validate: validGoal, row: goalRow as never, conflict: "id" },
};
const resourceOf = (value: string): MoneyResource | null => value in handlers ? value as MoneyResource : null;

export async function PUT(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { item?: unknown } | null;
  const item = handlers[resource].validate(body?.item);
  if (!item) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from(TABLES[resource]).upsert(handlers[resource].row(item as never, auth.user.id), { onConflict: handlers[resource].conflict });
  return error ? NextResponse.json({ error: "Không thể lưu" }, { status: 500 }) : NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const resource = resourceOf((await params).resource);
  if (!resource) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await auth.client.from(TABLES[resource]).delete().eq("id", id).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: "Không thể xóa" }, { status: 500 }) : NextResponse.json({ ok: true });
}
