import { NextResponse } from "next/server";
import pg from "pg";
import webpush from "web-push";
import { profileFromRow } from "@/lib/experience/profile-mapper";
import { remindersFor } from "@/lib/push/reminders";
import { checkFromRow, itemFromRow } from "@/lib/shopping/item-store-server";
import { estimateItems, itemRateResolver, localDate } from "@/lib/shopping/items";
import { purchaseFromRow } from "@/lib/shopping/purchase-store-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// DATE columns stay "YYYY-MM-DD" strings (the estimate math is date-only, in the family's local calendar).
const types = { getTypeParser: (oid: number, format?: string) => oid === 1082 ? (value: string) => value : pg.types.getTypeParser(oid, format as "text") };

/**
 * Daily "sắp hết" reminders (Vercel cron, vercel.json). For every family with a push subscription: estimate stock with
 * the same code as the app, push items at ≤3 days left, log each item once per day. Gone subscriptions are removed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!process.env.DATABASE_URL || !publicKey || !privateKey) return NextResponse.json({ error: "Chưa cấu hình thông báo" }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@famagent.app", publicKey, privateKey);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, types });
  const now = new Date();
  // Vietnam date for "once per day", whatever the server timezone.
  const today = localDate(new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60_000));
  let sent = 0; let removed = 0;
  try {
    await client.connect();
    const subs = (await client.query<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>("select id, user_id, endpoint, p256dh, auth from public.push_subscriptions")).rows;
    const users = [...new Set(subs.map((sub) => sub.user_id))];
    for (const userId of users) {
      const [family, items, purchases, checks, log] = await Promise.all([
        client.query(`select f.*, coalesce((select json_agg(c.*) from public.children c where c.family_profile_id = f.id), '[]'::json) as children from public.family_profiles f where f.user_id = $1`, [userId]),
        client.query("select * from public.shopping_items where user_id = $1 and status = 'active'", [userId]),
        client.query("select * from public.purchases where user_id = $1 and purchased_on > current_date - 400", [userId]),
        client.query("select * from public.stock_checks where user_id = $1 and checked_on > current_date - 400", [userId]),
        client.query<{ item_id: string }>("select item_id from public.push_log where user_id = $1 and day = $2", [userId, today]),
      ]);
      const profile = family.rows[0] ? profileFromRow(family.rows[0]) : null;
      const estimates = estimateItems(items.rows.map(itemFromRow), purchases.rows.map(purchaseFromRow), itemRateResolver(profile, now), now, checks.rows.map(checkFromRow));
      const reminders = remindersFor(estimates, new Set(log.rows.map((row) => row.item_id)));
      for (const reminder of reminders) {
        // Claim the (user, item, day) slot first so parallel runs never push twice.
        const claimed = await client.query("insert into public.push_log (user_id, item_id, day) values ($1, $2, $3) on conflict do nothing", [userId, reminder.itemId, today]);
        if (!claimed.rowCount) continue;
        for (const sub of subs.filter((entry) => entry.user_id === userId)) {
          try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(reminder), { TTL: 12 * 3600 }); sent++; }
          catch (cause) {
            const status = (cause as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) { await client.query("delete from public.push_subscriptions where id = $1", [sub.id]); removed++; }
            else console.warn("[push]", JSON.stringify({ status: status ?? "error" }));
          }
        }
      }
    }
    return NextResponse.json({ ok: true, families: users.length, sent, removed });
  } catch (cause) {
    console.error("[cron reminders]", cause instanceof Error ? cause.message : "error");
    return NextResponse.json({ error: "Không gửi được nhắc" }, { status: 500 });
  } finally { await client.end().catch(() => {}); }
}
