import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { TASK_ID as TASK } from "@/lib/brief/daily-tasks";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

/** GET /api/routine?from=YYYY-MM-DD → { done: { "YYYY-MM-DD": [taskId…] } } for the streak window. */
export async function GET(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const from = new URL(request.url).searchParams.get("from");
  if (!from || !DAY.test(from)) return NextResponse.json({ error: "Thiếu ngày bắt đầu" }, { status: 400 });
  const { data, error } = await auth.client.from("daily_task_done").select("day,task_id").eq("user_id", auth.user.id).gte("day", from).order("day").limit(2000);
  if (error) return NextResponse.json({ error: "Không thể tải việc đã làm" }, { status: 500 });
  const done: Record<string, string[]> = {};
  for (const row of data ?? []) (done[row.day as string] ??= []).push(row.task_id as string);
  return NextResponse.json({ done }, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT { day, taskId, done } → tick or untick one task for one day. */
export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { day?: unknown; taskId?: unknown; done?: unknown } | null;
  if (typeof body?.day !== "string" || !DAY.test(body.day) || typeof body.taskId !== "string" || body.taskId.length > 120 || !TASK.test(body.taskId) || typeof body.done !== "boolean") return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const table = auth.client.from("daily_task_done");
  const { error } = body.done
    ? await table.upsert({ user_id: auth.user.id, day: body.day, task_id: body.taskId }, { onConflict: "user_id,day,task_id", ignoreDuplicates: true })
    : await table.delete().eq("user_id", auth.user.id).eq("day", body.day).eq("task_id", body.taskId);
  return error ? NextResponse.json({ error: "Không thể lưu" }, { status: 500 }) : NextResponse.json({ ok: true });
}
