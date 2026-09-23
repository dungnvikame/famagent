// Anonymous guest cleanup + account report (plan P8, decision D5/D6).
//   DATABASE_URL=... node scripts/cleanup-anonymous.mjs [--days=30] [--apply]
// Report-only by default: users, anonymous guests, email-linked rate, and how many guests have been inactive
// longer than --days. --apply deletes those auth users; family profile, children, conversations/messages,
// saved products, quota rows and agent traces cascade; recommendation sessions, clicks and analytics events
// keep their rows with user_id set to null (anonymous aggregates stay usable).
// A guest who requested email linking but never confirmed it is still is_anonymous and is included.
// Backup rule: dump auth.users and the public user tables before --apply.
import pg from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const days = Number(args.find((arg) => arg.startsWith("--days="))?.split("=")[1] ?? 30);
if (!process.env.DATABASE_URL) { console.error("Cần DATABASE_URL (chỉ đặt ở server)."); process.exit(1); }
if (!Number.isInteger(days) || days < 7) { console.error("--days phải là số nguyên ≥ 7."); process.exit(1); }

// Last activity = latest of sign-in, account update, session refresh and conversation update.
const INACTIVE = `
  select u.id from auth.users u
  where u.is_anonymous
    and greatest(
      coalesce(u.last_sign_in_at, u.created_at), u.updated_at,
      coalesce((select max(s.updated_at) from auth.sessions s where s.user_id = u.id), u.created_at),
      coalesce((select max(c.updated_at) from public.conversations c where c.user_id = u.id), u.created_at)
    ) < now() - make_interval(days => $1)`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows: [stats] } = await client.query(`
    select count(*)::int as users,
           count(*) filter (where u.is_anonymous)::int as anonymous,
           count(*) filter (where not u.is_anonymous)::int as linked,
           count(*) filter (where f.onboarded_at is not null)::int as onboarded,
           count(*) filter (where f.onboarded_at is not null and not u.is_anonymous)::int as onboarded_linked
    from auth.users u left join public.family_profiles f on f.user_id = u.id`);
  const linkRate = stats.onboarded ? Math.round((stats.onboarded_linked / stats.onboarded) * 1000) / 10 : 0;
  console.log(`Người dùng: ${stats.users} (ẩn danh ${stats.anonymous}, đã liên kết email ${stats.linked}).`);
  console.log(`Đã hoàn tất onboarding: ${stats.onboarded}; trong đó liên kết email: ${stats.onboarded_linked} (${linkRate}%).`);
  const { rows: inactive } = await client.query(INACTIVE, [days]);
  console.log(`Khách ẩn danh không hoạt động > ${days} ngày: ${inactive.length}.`);
  if (!apply) { if (inactive.length) console.log("Chạy lại với --apply để xóa (sau khi sao lưu)."); }
  else if (inactive.length) {
    let deleted = 0;
    // Batches keep each transaction short; the inactivity condition is re-checked at delete time.
    for (;;) {
      const result = await client.query(`delete from auth.users where id in (${INACTIVE} limit 500)`, [days]);
      deleted += result.rowCount;
      if (result.rowCount < 500) break;
    }
    console.log(`Đã xóa ${deleted} khách ẩn danh và dữ liệu cá nhân đi kèm.`);
  }
} finally {
  await client.end();
}
