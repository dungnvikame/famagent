// Apply supabase/migrations/*.sql in filename order, each once, each in its own transaction (plan P8).
//   node --env-file=.env.local scripts/db-migrate.mjs [--status]
// Applied files are recorded in ops.schema_migrations (a schema the Supabase Data API does not expose).
// Refuses to run on a database that already has app tables but no record — back up and apply by hand then.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const statusOnly = process.argv.includes("--status");
if (!process.env.DATABASE_URL) { console.error("Cần DATABASE_URL (đặt trong apps/web/.env.local)."); process.exit(1); }
const dir = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const files = readdirSync(dir).filter((name) => /^\d{12}_[a-z0-9_]+\.sql$/.test(name)).sort();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("create schema if not exists ops; create table if not exists ops.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  await client.query("revoke all on schema ops from anon, authenticated");
  const applied = new Set((await client.query("select name from ops.schema_migrations")).rows.map((row) => row.name));
  const pending = files.filter((name) => !applied.has(name));
  if (!applied.size && pending.length) {
    const { rows: [existing] } = await client.query("select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name in ('products','family_profiles','conversations')");
    if (existing.count) { console.error("DB đã có bảng ứng dụng nhưng chưa có lịch sử migration. Sao lưu và kiểm tra thủ công trước."); process.exit(1); }
  }
  console.log(`Migration: ${files.length} file, đã chạy ${applied.size}, chờ ${pending.length}.`);
  if (statusOnly) { for (const name of pending) console.log(`  chờ: ${name}`); process.exit(0); }
  for (const name of pending) {
    const sql = readFileSync(dir + name, "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into ops.schema_migrations(name) values ($1)", [name]);
      await client.query("commit");
      console.log(`  ✓ ${name}`);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.error(`  ✗ ${name}: ${error.message}`);
      process.exit(1);
    }
  }
  // Verify: every public table has RLS on, and the key functions exist.
  const { rows: tables } = await client.query("select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1");
  const noRls = tables.filter((table) => !table.rls).map((table) => table.name);
  const { rows: functions } = await client.query("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('consume_request_quota','record_offer_snapshots')");
  console.log(`Bảng public: ${tables.length}; thiếu RLS: ${noRls.length ? noRls.join(", ") : "không"}; hàm: ${functions.map((row) => row.proname).sort().join(", ")}.`);
  if (noRls.length) process.exitCode = 2;
} finally {
  await client.end();
}
