// Import a verified diaper catalog CSV (data/products.template.csv). Usage:
//   DATABASE_URL=... pnpm import-products -- data/products.csv            (validate + import in one transaction)
//   pnpm import-products -- data/products.csv --dry-run                  (validate only, no DATABASE_URL needed)
// Options: --max-age-hours=48 (older price observations are imported as availability 'unknown'),
//          --allow-domain-change (let the CSV change the domain of a merchant already in the DB).
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCatalog, parseCsv, staleOffers } from "./lib/catalog-csv.mjs";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const dryRun = args.includes("--dry-run");
const allowDomainChange = args.includes("--allow-domain-change");
const maxAgeHours = Number(args.find((argument) => argument.startsWith("--max-age-hours="))?.split("=")[1] ?? 48);
const file = args.find((argument) => !argument.startsWith("--"));
if (!file || (!dryRun && !process.env.DATABASE_URL) || !(maxAgeHours > 0)) {
  console.error("Cách dùng: DATABASE_URL=... pnpm import-products -- <đường-dẫn-csv> [--dry-run] [--max-age-hours=48] [--allow-domain-change]");
  process.exit(1);
}
const csvPath = isAbsolute(file) ? file : resolve(fileURLToPath(new URL("../../..", import.meta.url)), file);
const rows = parseCsv(readFileSync(csvPath, "utf8"));
if (!rows.length) { console.error("CSV không có sản phẩm"); process.exit(1); }
const problems = checkCatalog(rows);
if (problems.length) {
  console.error(`Có ${problems.length} lỗi, chưa nhập gì:`);
  for (const problem of problems) console.error(`  Dòng ${problem.line}: ${problem.message}`);
  process.exit(1);
}
const products = new Set(rows.map((row) => row.product_id)).size;
const variants = new Set(rows.map((row) => row.variant_id)).size;
const stale = new Set(staleOffers(rows, new Date(), maxAgeHours).map((row) => row.offer_id));
if (stale.size) console.warn(`${stale.size} offer có giá xác minh quá ${maxAgeHours}h, sẽ nhập với availability='unknown' (không hiện nút mua): ${[...stale].join(", ")}`);
if (dryRun) { console.log(`Hợp lệ: ${products} sản phẩm, ${variants} variant, ${rows.length} offer. Chưa ghi DB (--dry-run).`); process.exit(0); }

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const num = (value) => value ? Number(value) : null;
try {
  await client.query("begin");
  // Changing a merchant's domain would orphan its existing offers' URLs; require an explicit flag.
  const csvDomains = new Map(rows.map((row) => [row.merchant_id, row.merchant_domain.toLowerCase()]));
  const { rows: existing } = await client.query("select id, domain from public.merchants where id = any($1::text[])", [[...csvDomains.keys()]]);
  const changed = existing.filter((merchant) => merchant.domain && merchant.domain.toLowerCase() !== csvDomains.get(merchant.id));
  if (changed.length && !allowDomainChange) throw new Error(`CSV đổi domain của merchant đã có (${changed.map((merchant) => `${merchant.id}: ${merchant.domain} → ${csvDomains.get(merchant.id)}`).join("; ")}). Kiểm tra lại hoặc chạy với --allow-domain-change.`);
  if (changed.length) {
    const { rows: [orphans] } = await client.query("select count(*)::int as count from public.product_offers where merchant_id = any($1::text[]) and not (id = any($2::text[]))", [changed.map((merchant) => merchant.id), rows.map((row) => row.offer_id)]);
    if (orphans.count) console.warn(`${orphans.count} offer cũ của merchant đổi domain không có trong CSV; link của chúng sẽ bị /go chặn cho tới khi nhập lại hoặc chạy verify-offers --apply.`);
  }
  // Slugs are unique across products; catch clashes with products outside this CSV before writing.
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const { rows: slugClashes } = await client.query("select id, slug from public.products where slug = any($1::text[]) and not (id = any($2::text[]))", [rows.map((row) => row.slug), productIds]);
  if (slugClashes.length) throw new Error(`Slug đã thuộc product khác trong DB: ${slugClashes.map((clash) => `${clash.slug} (${clash.id})`).join(", ")}`);
  for (const row of rows) {
    await client.query("insert into public.merchants(id,name,type,domain) values ($1,$2,'marketplace',$3) on conflict(id) do update set name=excluded.name,domain=excluded.domain", [row.merchant_id, row.merchant, row.merchant_domain]);
    await client.query("insert into public.products(id,slug,canonical_name,brand,category_slug,description,image_url,published) values ($1,$2,$3,$4,'diapers',$5,$6,true) on conflict(id) do update set slug=excluded.slug,canonical_name=excluded.canonical_name,brand=excluded.brand,description=excluded.description,image_url=excluded.image_url,published=true,updated_at=now()", [row.product_id, row.slug, row.name, row.brand, row.description || null, row.image_url]);
    await client.query(
      "insert into public.diaper_attributes(product_id,min_weight_kg,max_weight_kg,diaper_type,night_use_score,absorbency_score,softness_score,thickness_score,sensitive_skin_score,attribute_source,attribute_verified_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(product_id) do update set min_weight_kg=excluded.min_weight_kg,max_weight_kg=excluded.max_weight_kg,diaper_type=excluded.diaper_type,night_use_score=excluded.night_use_score,absorbency_score=excluded.absorbency_score,softness_score=excluded.softness_score,thickness_score=excluded.thickness_score,sensitive_skin_score=excluded.sensitive_skin_score,attribute_source=excluded.attribute_source,attribute_verified_at=excluded.attribute_verified_at",
      [row.product_id, Number(row.min_weight_kg), Number(row.max_weight_kg), row.diaper_type, num(row.night_use_score), num(row.absorbency_score), num(row.softness_score), num(row.thickness_score), num(row.sensitive_skin_score), row.attribute_source || null, row.attribute_verified_at ? new Date(row.attribute_verified_at).toISOString() : null],
    );
    await client.query("insert into public.product_variants(id,product_id,name,size,quantity,gtin,sku) values ($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set name=excluded.name,size=excluded.size,quantity=excluded.quantity,gtin=excluded.gtin,sku=excluded.sku", [row.variant_id, row.product_id, row.variant, row.size.toUpperCase(), Number(row.quantity), row.gtin || null, row.sku || null]);
    // updated_at = when the price was actually observed, so freshness checks (48h) mean something.
    await client.query(
      "insert into public.product_offers(id,product_variant_id,merchant_id,source,price,availability,affiliate_url,seller_rating,shipping_estimate,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set price=excluded.price,availability=excluded.availability,affiliate_url=excluded.affiliate_url,seller_rating=excluded.seller_rating,shipping_estimate=excluded.shipping_estimate,updated_at=excluded.updated_at",
      [row.offer_id, row.variant_id, row.merchant_id, row.source, Number(row.price), stale.has(row.offer_id) ? "unknown" : row.availability || "in_stock", row.affiliate_url, num(row.seller_rating), row.shipping_estimate || null, new Date(row.price_verified_at).toISOString()],
    );
  }
  await client.query("commit");
  console.log(`Đã nhập ${products} sản phẩm, ${variants} variant, ${rows.length} offer từ ${file}`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
