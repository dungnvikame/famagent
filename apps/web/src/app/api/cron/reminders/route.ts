import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import pg from "pg";
import webpush from "web-push";
import { profileFromRow } from "@/lib/experience/profile-mapper";
import { remindersFor } from "@/lib/push/reminders";
import { checkFromRow, itemFromRow } from "@/lib/shopping/item-store-server";
import { estimateItems, itemRateResolver } from "@/lib/shopping/items";
import { purchaseFromRow } from "@/lib/shopping/purchase-store-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// DATE columns stay "YYYY-MM-DD" strings (the estimate math is date-only, in the family's local calendar).
const types = { getTypeParser: (oid: number, format?: string) => oid === 1082 ? (value: string) => value : pg.types.getTypeParser(oid, format as "text") };
/** Families processed at once, and the push service timeout: one slow endpoint must not starve everyone else. */
const FAMILY_BATCH = 10;
const SEND_TIMEOUT_MS = 5_000;

const sameSecret = (given: string | null, expected: string) => { const a = Buffer.from(given ?? ""); const b = Buffer.from(`Bearer ${expected}`); return a.length === b.length && timingSafeEqual(a, b); };

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Daily "sắp hết" reminders (Vercel cron, vercel.json). For every family with a push subscription: estimate stock with
 * the same code as the app (Vietnam date), push items at ≤3 days left once per item per day, drop gone subscriptions.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization"), secret)) return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!process.env.DATABASE_URL || !publicKey || !privateKey) return NextResponse.json({ error: "Chưa cấu hình thông báo" }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@famagent.app", publicKey, privateKey);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, types });
  const vn = new Date(Date.now() + 7 * 3_600_000);
  const today = vn.toISOString().slice(0, 10);
  // Noon on the Vietnam date, so estimateItems' local-date math gives `today` whatever the server timezone.
  const now = new Date(`${today}T12:00:00`);
  let sent = 0; let removed = 0;
  try {
    await client.connect();
    const subs = (await client.query<Sub>("select id, user_id, endpoint, p256dh, auth from public.push_subscriptions")).rows;
    const users = [...new Set(subs.map((sub) => sub.user_id))];

    async function remind(userId: string) {
      const [family, items, purchases, checks, log] = await Promise.all([
        client.query(`select f.*, coalesce((select json_agg(c.*) from public.children c where c.family_profile_id = f.id), '[]'::json) as children from public.family_profiles f where f.user_id = $1`, [userId]),
        client.query("select * from public.shopping_items where user_id = $1 and status = 'active'", [userId]),
        client.query("select * from public.purchases where user_id = $1 and purchased_on > current_date - 400", [userId]),
        client.query("select * from public.stock_checks where user_id = $1 and checked_on > current_date - 400", [userId]),
        client.query<{ item_id: string; day: string }>("select item_id, day from public.push_log where user_id = $1 and day > $2::date - 14", [userId, today]),
      ]);
      const profile = family.rows[0] ? profileFromRow(family.rows[0]) : null;
      const estimates = estimateItems(items.rows.map(itemFromRow), purchases.rows.map(purchaseFromRow), itemRateResolver(profile, now), now, checks.rows.map(checkFromRow));
      const recent = new Map<string, number>();
      for (const row of log.rows) recent.set(row.item_id, (recent.get(row.item_id) ?? 0) + 1);
      const reminders = remindersFor(estimates, new Set(log.rows.filter((row) => row.day === today).map((row) => row.item_id)), 2, recent);
      const devices = subs.filter((sub) => sub.user_id === userId);
      for (const reminder of reminders) {
        // Claim the (user, item, day) slot first so parallel runs never push twice; release it if no device got it.
        const claimed = await client.query("insert into public.push_log (user_id, item_id, day) values ($1, $2, $3) on conflict do nothing", [userId, reminder.itemId, today]);
        if (!claimed.rowCount) continue;
        const results = await Promise.allSettled(devices.map((sub) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(reminder), { TTL: 12 * 3600, timeout: SEND_TIMEOUT_MS })));
        let delivered = 0;
        for (const [index, result] of results.entries()) {
          if (result.status === "fulfilled") { delivered++; continue; }
          const status = (result.reason as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) { await client.query("delete from public.push_subscriptions where id = $1", [devices[index].id]); removed++; }
          else console.warn("[push]", JSON.stringify({ status: status ?? "error" }));
        }
        sent += delivered;
        if (!delivered) await client.query("delete from public.push_log where user_id = $1 and item_id = $2 and day = $3", [userId, reminder.itemId, today]);
      }
    }

    for (let index = 0; index < users.length; index += FAMILY_BATCH) {
      const batch = await Promise.allSettled(users.slice(index, index + FAMILY_BATCH).map(remind));
      for (const result of batch) if (result.status === "rejected") console.warn("[cron reminders] family", result.reason instanceof Error ? result.reason.message : "error");
    }
    return NextResponse.json({ ok: true, families: users.length, sent, removed });
  } catch (cause) {
    console.error("[cron reminders]", cause instanceof Error ? cause.message : "error");
    return NextResponse.json({ error: "Không gửi được nhắc" }, { status: 500 });
  } finally { await client.end().catch(() => {}); }
}
