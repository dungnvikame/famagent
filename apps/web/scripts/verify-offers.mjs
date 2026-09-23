// Daily offer check (plan P6, spec v1 §10.3): link reachable over HTTPS, every redirect hop still on the
// approved merchant domain, price observed within the freshness window. Report-only by default; --apply
// marks failing offers availability='unknown' so the catalog stops recommending them (never deletes data).
//   DATABASE_URL=... node scripts/verify-offers.mjs [--apply [--force]] [--max-age-hours=48]
// --apply is refused when more than 20% fail (likely a network outage or bot blocking) unless --force.
import pg from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const maxAgeHours = Number(args.find((arg) => arg.startsWith("--max-age-hours="))?.split("=")[1] ?? 48);
if (!process.env.DATABASE_URL) { console.error("Cần DATABASE_URL (chỉ đặt ở server)."); process.exit(1); }
if (!(maxAgeHours > 0)) { console.error("--max-age-hours phải là số dương."); process.exit(1); }

async function request(url, method) {
  const response = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(8000) });
  await response.body?.cancel().catch(() => {});
  return response;
}

/** Follows redirects manually so every hop can be checked against the merchant domain. Never throws. */
async function checkLink(url, domain) {
  let current = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const target = new URL(current);
      const host = target.hostname.toLowerCase();
      if (target.protocol !== "https:") return { ok: false, reason: `không dùng HTTPS (${target.protocol})` };
      if (host !== domain && !host.endsWith(`.${domain}`)) return { ok: false, reason: `chuyển hướng ra ngoài ${domain} (${host})` };
      let response = await request(current, "HEAD");
      // Some merchants reject HEAD; retry once with GET before judging.
      if (response.status === 405 || response.status === 403) response = await request(current, "GET");
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) { current = new URL(location, current).toString(); continue; }
      return response.status < 400 ? { ok: true } : { ok: false, reason: `HTTP ${response.status}` };
    }
    return { ok: false, reason: "quá nhiều lần chuyển hướng" };
  } catch (error) {
    return { ok: false, reason: error instanceof TypeError && /URL/i.test(error.message) ? "URL không hợp lệ" : "không kết nối được" };
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    "select o.id, o.affiliate_url, o.updated_at, m.domain from public.product_offers o join public.merchants m on m.id = o.merchant_id where o.availability = 'in_stock'",
  );
  const failures = [];
  for (const offer of rows) {
    const ageHours = (Date.now() - new Date(offer.updated_at).getTime()) / 3_600_000;
    if (ageHours > maxAgeHours) { failures.push({ ...offer, reason: `giá quá ${maxAgeHours}h chưa xác minh (${Math.round(ageHours)}h)` }); continue; }
    if (!offer.affiliate_url || !offer.domain) { failures.push({ ...offer, reason: "thiếu URL hoặc merchant domain" }); continue; }
    const result = await checkLink(offer.affiliate_url, offer.domain.toLowerCase());
    if (!result.ok) failures.push({ ...offer, reason: result.reason });
  }
  const rate = rows.length ? Math.round((failures.length / rows.length) * 1000) / 10 : 0;
  console.log(`Đã kiểm tra ${rows.length} offer còn hàng: ${failures.length} lỗi (${rate}%; ngưỡng phát hành ≤5%).`);
  for (const failure of failures) console.log(`  ${failure.id}: ${failure.reason}`);
  if (apply && failures.length && rate > 20 && !force) {
    console.log("Tỷ lệ lỗi >20%: có thể do mất mạng hoặc merchant chặn bot. Không ẩn offer nào; kiểm tra rồi chạy lại với --apply --force nếu đúng là lỗi thật.");
  } else if (apply && failures.length) {
    // Backup rule: this is a data change — take a dump of product_offers before running with --apply.
    // Only hide offers not refreshed since they were read, so a concurrent re-import is not overwritten.
    const result = await client.query(
      "update public.product_offers o set availability = 'unknown' from unnest($1::text[], $2::timestamptz[]) as f(id, seen) where o.id = f.id and date_trunc('milliseconds', o.updated_at) = f.seen",
      [failures.map((failure) => failure.id), failures.map((failure) => failure.updated_at)],
    );
    console.log(`Đã chuyển ${result.rowCount} offer sang availability='unknown'.`);
  } else if (failures.length) console.log("Chạy lại với --apply để ẩn các offer này (sau khi sao lưu product_offers).");
  process.exitCode = rate > 5 ? 2 : 0;
} finally {
  await client.end();
}
