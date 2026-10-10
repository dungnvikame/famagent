import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import pg from "pg";
import webpush from "web-push";
import { childAgeMonths, profileFromRow } from "@/lib/experience/profile-mapper";
import { measureDue, measurePush } from "@/lib/family/measure-schedule";
import { tipPushFor } from "@/lib/family/age-guide";
import { remindersFor } from "@/lib/push/reminders";
import { tripRemindersFor } from "@/lib/push/travel-reminders";
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

/** Measuring reminders per family per day (the rest wait for tomorrow). */
const MEASURE_LIMIT = 2;
const vnDayOf = (iso?: string) => iso && !Number.isNaN(Date.parse(iso)) ? new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10) : undefined;

/**
 * Daily reminders (Vercel cron, vercel.json), for every family with a push subscription:
 * - "sắp hết": estimate stock with the same code as the app (Vietnam date), push items at ≤3 days left once per item per day;
 * - "đến lịch cân đo": children due for weighing / measuring on the family's cadence, at most once a week per child;
 * - "Mẹo hôm nay": one age-guide tip (not tried yet) for the youngest child under 6, once a day, unless turned off.
 * Gone subscriptions are dropped.
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
      let devices = subs.filter((sub) => sub.user_id === userId);
      /** Sends to every device of the family; drops subscriptions the push service says are gone. */
      async function deliver(payload: object): Promise<number> {
        const results = await Promise.allSettled(devices.map((sub) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 12 * 3600, timeout: SEND_TIMEOUT_MS })));
        let delivered = 0;
        const gone = new Set<string>();
        for (const [index, result] of results.entries()) {
          if (result.status === "fulfilled") { delivered++; continue; }
          const status = (result.reason as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) { await client.query("delete from public.push_subscriptions where id = $1", [devices[index].id]); gone.add(devices[index].id); removed++; }
          else console.warn("[push]", JSON.stringify({ status: status ?? "error" }));
        }
        devices = devices.filter((sub) => !gone.has(sub.id));
        sent += delivered;
        return delivered;
      }
      for (const reminder of reminders) {
        // Claim the (user, item, day) slot first so parallel runs never push twice; release it if no device got it.
        const claimed = await client.query("insert into public.push_log (user_id, item_id, day) values ($1, $2, $3) on conflict do nothing", [userId, reminder.itemId, today]);
        if (!claimed.rowCount) continue;
        if (!await deliver(reminder)) await client.query("delete from public.push_log where user_id = $1 and item_id = $2 and day = $3", [userId, reminder.itemId, today]);
      }

      // Trip reminders (T-7, T-2, wrap-up); kept apart so a missing migration 0028 never blocks the others.
      if (devices.length) try {
        const trips = await client.query<{ id: string; name: string; start_date: string; end_date: string; status: string; push_enabled: boolean }>(
          "select id, name, start_date, end_date, status, push_enabled from public.travel_trips where user_id = $1 and push_enabled and status not in ('cancelled','done') and start_date <= $2::date + 8 and end_date >= $2::date - 2", [userId, today]);
        if (trips.rows.length) {
          const packing = await client.query<{ trip_id: string; todo_left: string }>("select trip_id, count(*) filter (where status = 'todo') as todo_left from public.travel_packing_items where user_id = $1 group by trip_id", [userId]);
          const packLeft = new Map(packing.rows.map((row) => [row.trip_id, Number(row.todo_left) || 0]));
          const pushes = tripRemindersFor(trips.rows.map((row) => ({ id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, status: row.status as "planning", pushEnabled: row.push_enabled })), packLeft, today);
          for (const push of pushes) {
            const claimed = await client.query("insert into public.travel_push_log (user_id, trip_id, kind, day) values ($1, $2, $3, $4) on conflict do nothing", [userId, push.tripId, push.kind, today]);
            if (!claimed.rowCount) continue;
            if (!await deliver({ title: push.title, body: push.body, url: push.url, tag: push.tag })) await client.query("delete from public.travel_push_log where user_id = $1 and trip_id = $2 and kind = $3 and day = $4", [userId, push.tripId, push.kind, today]);
          }
        }
      } catch (cause) { console.warn("[cron reminders] travel", cause instanceof Error ? cause.message : "error"); }

      // Measuring reminders; kept apart so a problem here (e.g. migration 0024 missing) never blocks the stock ones.
      if (!profile?.children.length || !devices.length) return;
      try {
        const [lastMeasured, lastPushed] = await Promise.all([
          client.query<{ child_id: string; weight: string | null; height: string | null }>("select child_id, max(measured_on) filter (where weight_kg is not null) as weight, max(measured_on) filter (where height_cm is not null) as height from public.child_weights where user_id = $1 group by child_id", [userId]),
          client.query<{ child_id: string; day: string }>("select child_id, max(day) as day from public.measure_push_log where user_id = $1 group by child_id", [userId]),
        ]);
        const measured = new Map(lastMeasured.rows.map((row) => [row.child_id, row]));
        const pushed = new Map(lastPushed.rows.map((row) => [row.child_id, row.day]));
        const pushes = profile.children.flatMap((child, index) => {
          const last = measured.get(child.id);
          const due = measureDue({ ageMonths: childAgeMonths(child, now), lastWeight: last?.weight ?? vnDayOf(profile.fieldMeta?.[`children.${child.id}.weightKg`]?.observedAt), lastHeight: last?.height ?? undefined, today, every: profile.household?.measureEvery });
          const push = measurePush(child.id, child.name || `bé ${index + 1}`, due, today, pushed.get(child.id));
          return push ? [push] : [];
        }).slice(0, MEASURE_LIMIT);
        for (const push of pushes) {
          const claimed = await client.query("insert into public.measure_push_log (user_id, child_id, day) values ($1, $2, $3) on conflict do nothing", [userId, push.childId, today]);
          if (!claimed.rowCount) continue;
          if (!await deliver(push)) await client.query("delete from public.measure_push_log where user_id = $1 and child_id = $2 and day = $3", [userId, push.childId, today]);
        }
      } catch (cause) { console.warn("[cron reminders] measure", cause instanceof Error ? cause.message : "error"); }

      // Daily tip; also kept apart (migration 0027 missing must not block the others).
      if (profile.household?.tipPush === false || !devices.length) return;
      try {
        const triedRows = await client.query<{ child_id: string; milestone_id: string }>("select child_id, milestone_id from public.child_milestones where user_id = $1 and status = 'done' and milestone_id like 'tip-%'", [userId]);
        const tried = new Map<string, Set<string>>();
        for (const row of triedRows.rows) { const set = tried.get(row.child_id) ?? new Set<string>(); set.add(row.milestone_id); tried.set(row.child_id, set); }
        const push = tipPushFor(profile.children.map((child, index) => ({ id: child.id, name: child.name || `bé ${index + 1}`, ageMonths: childAgeMonths(child, now) })), tried, today);
        if (!push) return;
        const claimed = await client.query("insert into public.tip_push_log (user_id, day, tip_id) values ($1, $2, $3) on conflict do nothing", [userId, today, push.tipId]);
        if (!claimed.rowCount) return;
        if (!await deliver({ title: push.title, body: push.body, url: push.url, tag: push.tag })) await client.query("delete from public.tip_push_log where user_id = $1 and day = $2", [userId, today]);
      } catch (cause) { console.warn("[cron reminders] tip", cause instanceof Error ? cause.message : "error"); }
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
