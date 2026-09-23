import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some((value) => value !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng");
  row.push(field); if (row.some((value) => value !== "")) rows.push(row);
  const [header, ...values] = rows;
  if (!header) throw new Error("CSV trống");
  return values.map((cells, index) => {
    if (cells.length !== header.length) throw new Error(`Dòng ${index + 2}: sai số cột`);
    return Object.fromEntries(header.map((key, i) => [key.trim(), cells[i].trim()]));
  });
}

function validate(row, index) {
  const required = ["product_id", "slug", "name", "brand", "image_url", "variant_id", "variant", "size", "quantity", "merchant_id", "merchant", "merchant_domain", "offer_id", "source", "price", "affiliate_url", "min_weight_kg", "max_weight_kg", "diaper_type"];
  for (const key of required) if (!row[key]) throw new Error(`Dòng ${index + 2}: thiếu ${key}`);
  if (row.category !== "diapers") throw new Error(`Dòng ${index + 2}: chỉ hỗ trợ diapers`);
  for (const key of ["quantity", "price", "min_weight_kg", "max_weight_kg"]) if (!Number.isFinite(Number(row[key])) || Number(row[key]) <= 0) throw new Error(`Dòng ${index + 2}: ${key} không hợp lệ`);
  if (!Number.isInteger(Number(row.quantity)) || !Number.isInteger(Number(row.price))) throw new Error(`Dòng ${index + 2}: quantity/price phải là số nguyên`);
  if (Number(row.max_weight_kg) < Number(row.min_weight_kg)) throw new Error(`Dòng ${index + 2}: khoảng cân nặng không hợp lệ`);
  if (!["tape", "pants"].includes(row.diaper_type)) throw new Error(`Dòng ${index + 2}: diaper_type không hợp lệ`);
  if (!["shopee", "tiktok", "lazada", "affiliate", "direct"].includes(row.source)) throw new Error(`Dòng ${index + 2}: source không hợp lệ`);
  for (const key of ["image_url", "affiliate_url"]) if (new URL(row[key]).protocol !== "https:") throw new Error(`Dòng ${index + 2}: ${key} phải dùng HTTPS`);
  const host = new URL(row.affiliate_url).hostname.toLowerCase();
  const domain = row.merchant_domain.toLowerCase();
  if (host !== domain && !host.endsWith(`.${domain}`)) throw new Error(`Dòng ${index + 2}: URL offer không thuộc merchant_domain`);
  if (row.night_use_score && (!Number.isInteger(Number(row.night_use_score)) || Number(row.night_use_score) < 1 || Number(row.night_use_score) > 5)) throw new Error(`Dòng ${index + 2}: night_use_score phải từ 1 đến 5`);
}

const file = process.argv.slice(2).find((argument) => argument !== "--");
if (!file || !process.env.DATABASE_URL) {
  console.error("Cách dùng: DATABASE_URL=... pnpm import-products -- <đường-dẫn-csv>");
  process.exit(1);
}
const csvPath = isAbsolute(file) ? file : resolve(fileURLToPath(new URL("../../..", import.meta.url)), file);
const rows = parseCsv(readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
if (!rows.length) throw new Error("CSV không có sản phẩm");
rows.forEach(validate);
const offerIds = rows.map((row) => row.offer_id);
if (new Set(offerIds).size !== offerIds.length) throw new Error("offer_id bị trùng trong CSV");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  for (const row of rows) {
    await client.query("insert into public.merchants(id,name,type,domain) values ($1,$2,'marketplace',$3) on conflict(id) do update set name=excluded.name,domain=excluded.domain", [row.merchant_id, row.merchant, row.merchant_domain]);
    await client.query("insert into public.products(id,slug,canonical_name,brand,category_slug,description,image_url,published) values ($1,$2,$3,$4,'diapers',$5,$6,true) on conflict(id) do update set slug=excluded.slug,canonical_name=excluded.canonical_name,brand=excluded.brand,description=excluded.description,image_url=excluded.image_url,published=true,updated_at=now()", [row.product_id, row.slug, row.name, row.brand, row.description || null, row.image_url]);
    await client.query("insert into public.diaper_attributes(product_id,min_weight_kg,max_weight_kg,diaper_type,night_use_score) values ($1,$2,$3,$4,$5) on conflict(product_id) do update set min_weight_kg=excluded.min_weight_kg,max_weight_kg=excluded.max_weight_kg,diaper_type=excluded.diaper_type,night_use_score=excluded.night_use_score", [row.product_id, Number(row.min_weight_kg), Number(row.max_weight_kg), row.diaper_type, row.night_use_score ? Number(row.night_use_score) : null]);
    await client.query("insert into public.product_variants(id,product_id,name,size,quantity) values ($1,$2,$3,$4,$5) on conflict(id) do update set name=excluded.name,size=excluded.size,quantity=excluded.quantity", [row.variant_id, row.product_id, row.variant, row.size, Number(row.quantity)]);
    await client.query("insert into public.product_offers(id,product_variant_id,merchant_id,source,price,availability,affiliate_url) values ($1,$2,$3,$4,$5,'in_stock',$6) on conflict(id) do update set price=excluded.price,availability='in_stock',affiliate_url=excluded.affiliate_url,updated_at=now()", [row.offer_id, row.variant_id, row.merchant_id, row.source, Number(row.price), row.affiliate_url]);
  }
  await client.query("commit");
  console.log(`Đã nhập ${rows.length} offer từ ${file}`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
