import { NextResponse } from "next/server";
import { allInsights } from "@/lib/attention/engine";
import { loadSnapshotPg } from "@/lib/attention/snapshot-pg";
import { familyPolicy } from "@/lib/policy/family-policy";
import { remindersFor } from "@/lib/push/reminders";
import { claim, cronAuthorized, forEachFamily, jobClient, pushReady, release, sendToDevices, vietnamToday } from "@/lib/push/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily proactive reminders (Vercel cron, 08:00 VN). For every family with a device: the same attention engine as Home
 * (Family State + Family Policy), then at most 2 pushes — stock running low, unusual category spend, bills due — minus
 * anything the family muted or snoozed, once per insight per day (notification_log).
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  if (!pushReady()) return NextResponse.json({ error: "Chưa cấu hình thông báo" }, { status: 503 });
  const client = jobClient();
  const { today, now } = vietnamToday();
  let sent = 0; let removed = 0;
  try {
    const families = await forEachFamily(client, async (userId, devices) => {
      const state = await loadSnapshotPg(client, userId, today, now);
      const policy = familyPolicy(state.snapshot.profile);
      const reminders = remindersFor(allInsights(state.snapshot, policy, now), { feedback: state.feedback, sentToday: state.sentToday, sentThisWeek: state.sentThisWeek, recent: state.recent, today, policy, estimates: state.snapshot.estimates });
      for (const reminder of reminders) {
        if (!await claim(client, userId, reminder.key, today)) continue;
        const result = await sendToDevices(client, devices, reminder);
        sent += result.delivered; removed += result.removed;
        if (!result.delivered) await release(client, userId, reminder.key, today);
      }
    });
    return NextResponse.json({ ok: true, families, sent, removed });
  } catch (cause) {
    console.error("[cron reminders]", cause instanceof Error ? cause.message : "error");
    return NextResponse.json({ error: "Không gửi được nhắc" }, { status: 500 });
  } finally { await client.end().catch(() => {}); }
}
