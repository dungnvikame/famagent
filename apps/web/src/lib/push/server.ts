// Server side of Web Push for the reminder jobs: auth check, VAPID setup, pg client with date-as-string, fan-out sends.
import { timingSafeEqual } from "node:crypto";
import pg from "pg";
import webpush from "web-push";

export type PushSub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
/** One slow push service must not starve the other families. */
export const SEND_TIMEOUT_MS = 5_000;
export const FAMILY_BATCH = 10;

export const cronAuthorized = (header: string | null) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(header ?? ""); const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Configures VAPID; false when keys or DATABASE_URL are missing (jobs answer 503). */
export function pushReady(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!process.env.DATABASE_URL || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://famagent.vercel.app", publicKey, privateKey);
  return true;
}

// DATE columns stay "YYYY-MM-DD" strings (the estimate math is date-only, in the family's local calendar).
const types = { getTypeParser: (oid: number, format?: string) => oid === 1082 ? (value: string) => value : pg.types.getTypeParser(oid, format as "text") };
export const jobClient = () => new pg.Client({ connectionString: process.env.DATABASE_URL, types });

/** Vietnam date and a Date at noon of it, so local-date math gives that day whatever the server timezone. */
export function vietnamToday(): { today: string; now: Date } {
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  return { today, now: new Date(`${today}T12:00:00`) };
}

/** Sends one payload to every device of a family in parallel; drops subscriptions the push service says are gone. */
export async function sendToDevices(client: pg.Client, devices: PushSub[], payload: object): Promise<{ delivered: number; removed: number }> {
  const results = await Promise.allSettled(devices.map((sub) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 12 * 3600, timeout: SEND_TIMEOUT_MS })));
  let delivered = 0; let removed = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") { delivered++; continue; }
    const status = (result.reason as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) { await client.query("delete from public.push_subscriptions where id = $1", [devices[index].id]); removed++; }
    else console.warn("[push]", JSON.stringify({ status: status ?? "error" }));
  }
  return { delivered, removed };
}

/** Claims (user, key, day) in notification_log; false when another run already sent it. */
export async function claim(client: pg.Client, userId: string, key: string, day: string): Promise<boolean> {
  const result = await client.query("insert into public.notification_log (user_id, key, day) values ($1, $2, $3) on conflict do nothing", [userId, key, day]);
  return Boolean(result.rowCount);
}
export const release = (client: pg.Client, userId: string, key: string, day: string) => client.query("delete from public.notification_log where user_id = $1 and key = $2 and day = $3", [userId, key, day]);

/** Runs `work` for every family with a device, FAMILY_BATCH at a time. */
export async function forEachFamily(client: pg.Client, work: (userId: string, devices: PushSub[]) => Promise<void>): Promise<number> {
  const subs = (await client.query<PushSub>("select id, user_id, endpoint, p256dh, auth from public.push_subscriptions")).rows;
  const users = [...new Set(subs.map((sub) => sub.user_id))];
  for (let index = 0; index < users.length; index += FAMILY_BATCH) {
    const batch = await Promise.allSettled(users.slice(index, index + FAMILY_BATCH).map((userId) => work(userId, subs.filter((sub) => sub.user_id === userId))));
    for (const result of batch) if (result.status === "rejected") console.warn("[cron] family", result.reason instanceof Error ? result.reason.message : "error");
  }
  return users.length;
}
