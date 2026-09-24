import { NextResponse } from "next/server";
import { FEEDBACK_VERDICTS, feedbackFor, type FeedbackVerdict, type InsightFeedback } from "@/lib/attention/engine";
import { authenticated } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

/** GET → the family's answers to insights (engine filter). */
export async function GET() {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const { data, error } = await auth.client.from("insight_feedback").select("key,verdict,until").eq("user_id", auth.user.id).limit(1000);
  if (error) return NextResponse.json({ error: "Không thể tải phản hồi" }, { status: 500 });
  const feedback: InsightFeedback[] = (data ?? []).map((row) => ({ key: row.key as string, verdict: row.verdict as FeedbackVerdict, until: (row.until as string | null) ?? undefined }));
  return NextResponse.json({ feedback }, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT { key, verdict } → the hide window is computed here (server clock), one row per key. */
export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth || auth.user.is_anonymous) return unauthorized();
  const body = await request.json().catch(() => null) as { key?: unknown; verdict?: unknown } | null;
  // kind:subject from the engine (or weekly_brief:all) — nothing else is stored.
  const key = typeof body?.key === "string" && body.key.length <= 200 && /^(pending_question|stock_low|money_pace|category_spike|bill_due|stage_size|weight_missing|weight_stale|weekly_brief):[\p{L}\p{N}:._ -]{1,180}$/u.test(body.key) ? body.key : null;
  const verdict = FEEDBACK_VERDICTS.includes(body?.verdict as FeedbackVerdict) ? body!.verdict as FeedbackVerdict : null;
  if (!key || !verdict) return NextResponse.json({ error: "Phản hồi không hợp lệ" }, { status: 400 });
  const entry = feedbackFor(key, verdict, new Date(Date.now() + 7 * 3_600_000));
  const { error } = await auth.client.from("insight_feedback").upsert({ user_id: auth.user.id, key, verdict, until: entry.until ?? null, created_at: new Date().toISOString() }, { onConflict: "user_id,key" });
  return error ? NextResponse.json({ error: "Không thể lưu phản hồi" }, { status: 500 }) : NextResponse.json({ feedback: entry });
}
