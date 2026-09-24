import { NextResponse } from "next/server";
import { silenced } from "@/lib/attention/engine";
import { loadSnapshotPg } from "@/lib/attention/snapshot-pg";
import { buildWeekly } from "@/lib/attention/weekly";
import { claim, cronAuthorized, forEachFamily, jobClient, pushReady, release, sendToDevices, vietnamToday } from "@/lib/push/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Weekly Family Brief push (Vercel cron, Sunday 19:00 VN): one line, opens /home/week. "Đừng nhắc" on it mutes it. */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  if (!pushReady()) return NextResponse.json({ error: "Chưa cấu hình thông báo" }, { status: 503 });
  const client = jobClient();
  const { today, now } = vietnamToday();
  const key = `weekly_brief:${today}`;
  let sent = 0;
  try {
    const families = await forEachFamily(client, async (userId, devices) => {
      const state = await loadSnapshotPg(client, userId, today, now);
      if (silenced("weekly_brief:all", state.feedback, today) || !await claim(client, userId, key, today)) return;
      const brief = buildWeekly(state.snapshot, state.purchases, now);
      const result = await sendToDevices(client, devices, { key, title: "Nhà mình tuần này", body: brief.headline, url: "/home/week", tag: "weekly-brief" });
      sent += result.delivered;
      if (!result.delivered) await release(client, userId, key, today);
    });
    return NextResponse.json({ ok: true, families, sent });
  } catch (cause) {
    console.error("[cron weekly]", cause instanceof Error ? cause.message : "error");
    return NextResponse.json({ error: "Không gửi được bản tin tuần" }, { status: 500 });
  } finally { await client.end().catch(() => {}); }
}
