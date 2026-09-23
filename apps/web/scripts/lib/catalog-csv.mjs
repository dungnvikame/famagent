// CSV parsing + validation for the diaper catalog import (plan P6, spec v1 §10). Pure functions so the
// rules are unit-tested; import-products.mjs only adds the database transaction.

export const REQUIRED = ["product_id", "slug", "name", "brand", "category", "image_url", "variant_id", "variant", "size", "quantity", "merchant_id", "merchant", "merchant_domain", "offer_id", "source", "price", "affiliate_url", "min_weight_kg", "max_weight_kg", "diaper_type", "price_verified_at"];
export const SCORE_COLUMNS = ["night_use_score", "absorbency_score", "softness_score", "thickness_score", "sensitive_skin_score"];
export const OPTIONAL = [...SCORE_COLUMNS, "attribute_source", "attribute_verified_at", "description", "availability", "seller_rating", "shipping_estimate", "gtin", "sku"];
const SIZES = ["NB", "S", "M", "L", "XL", "XXL"];
const SOURCES = ["shopee", "tiktok", "lazada", "affiliate", "direct"];
const INT_MAX = 2_147_483_647;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field); if (row.some((value) => value !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng");
  row.push(field); if (row.some((value) => value !== "")) rows.push(row);
  const [header, ...values] = rows;
  if (!header) throw new Error("CSV trống");
  const keys = header.map((key) => key.trim());
  const duplicated = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicated.length) throw new Error(`Cột bị lặp: ${[...new Set(duplicated)].join(", ")}`);
  const unknown = keys.filter((key) => !REQUIRED.includes(key) && !OPTIONAL.includes(key));
  if (unknown.length) throw new Error(`Cột không được hỗ trợ: ${unknown.join(", ")}`);
  const missing = REQUIRED.filter((key) => !keys.includes(key));
  if (missing.length) throw new Error(`Thiếu cột bắt buộc: ${missing.join(", ")}`);
  return values.map((cells, index) => {
    if (cells.length !== keys.length) return { __line: index + 2, __error: "sai số cột" };
    return { __line: index + 2, ...Object.fromEntries(keys.map((key, i) => [key, cells[i].trim()])) };
  });
}

const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const https = (value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

/** All problems of one row (empty array = valid). Never throws, so a file reports every issue at once. */
export function validateRow(row, now = new Date()) {
  if (row.__error) return [row.__error];
  const errors = [];
  for (const key of REQUIRED) if (!row[key]) errors.push(`thiếu ${key}`);
  if (row.category && row.category !== "diapers") errors.push("chỉ hỗ trợ category diapers");
  for (const key of ["quantity", "price", "min_weight_kg", "max_weight_kg"]) if (row[key] && !positiveNumber(row[key])) errors.push(`${key} không hợp lệ`);
  for (const key of ["quantity", "price"]) if (row[key] && (!Number.isInteger(Number(row[key])) || Number(row[key]) > INT_MAX)) errors.push(`${key} phải là số nguyên ≤ ${INT_MAX}`);
  for (const key of ["min_weight_kg", "max_weight_kg"]) if (positiveNumber(row[key]) && Number(row[key]) >= 1000) errors.push(`${key} phải nhỏ hơn 1000`);
  if (positiveNumber(row.min_weight_kg) && positiveNumber(row.max_weight_kg) && Number(row.max_weight_kg) < Number(row.min_weight_kg)) errors.push("khoảng cân nặng không hợp lệ");
  if (row.size && !SIZES.includes(row.size.toUpperCase())) errors.push(`size phải là ${SIZES.join("/")}`);
  if (row.diaper_type && !["tape", "pants"].includes(row.diaper_type)) errors.push("diaper_type phải là tape hoặc pants");
  if (row.source && !SOURCES.includes(row.source)) errors.push("source không hợp lệ");
  if (row.availability && !["in_stock", "out_of_stock"].includes(row.availability)) errors.push("availability phải là in_stock hoặc out_of_stock");
  for (const key of ["image_url", "affiliate_url"]) if (row[key] && !https(row[key])) errors.push(`${key} phải là URL HTTPS`);
  const domainValid = !row.merchant_domain || HOSTNAME.test(row.merchant_domain);
  if (!domainValid) errors.push("merchant_domain phải là hostname đầy đủ (vd. shopee.vn), không kèm https://, đường dẫn hay cổng");
  if (row.affiliate_url && row.merchant_domain && domainValid && https(row.affiliate_url)) {
    const host = new URL(row.affiliate_url).hostname.toLowerCase();
    const domain = row.merchant_domain.toLowerCase();
    if (host !== domain && !host.endsWith(`.${domain}`)) errors.push("URL offer không thuộc merchant_domain");
  }
  // Quality claims need a recorded source (spec v1 §10.2): no score without attribute_source.
  const scored = SCORE_COLUMNS.filter((key) => row[key]);
  for (const key of scored) if (!Number.isInteger(Number(row[key])) || Number(row[key]) < 1 || Number(row[key]) > 5) errors.push(`${key} phải là số nguyên 1–5`);
  if (scored.length && !row.attribute_source) errors.push("có điểm chất lượng nhưng thiếu attribute_source");
  if (scored.length && !row.attribute_verified_at) errors.push("có điểm chất lượng nhưng thiếu attribute_verified_at");
  if (row.attribute_source && row.attribute_source.length > 300) errors.push("attribute_source dài quá 300 ký tự");
  if (row.seller_rating && (!Number.isFinite(Number(row.seller_rating)) || Number(row.seller_rating) < 0 || Number(row.seller_rating) > 5)) errors.push("seller_rating phải từ 0 đến 5");
  for (const key of ["price_verified_at", "attribute_verified_at"]) {
    if (!row[key]) continue;
    const verified = Date.parse(row[key]);
    if (!ISO_TIME.test(row[key]) || Number.isNaN(verified)) errors.push(`${key} không phải thời điểm hợp lệ (ISO 8601 có múi giờ, vd. 2026-09-23T08:00:00+07:00)`);
    else if (verified > now.getTime() + 3_600_000) errors.push(`${key} ở tương lai`);
  }
  return errors;
}

/** Cross-row rules: unique offers and slugs, consistent merchants/products/variants, one variant per product+size+quantity. */
export function validateCatalog(rows) {
  const errors = [];
  const seenOffers = new Map(); const products = new Map(); const variants = new Map(); const packs = new Map(); const merchants = new Map(); const slugs = new Map();
  for (const row of rows) {
    if (row.__error) continue;
    if (seenOffers.has(row.offer_id)) errors.push({ line: row.__line, message: `offer_id ${row.offer_id} trùng với dòng ${seenOffers.get(row.offer_id)}` });
    else seenOffers.set(row.offer_id, row.__line);
    const merchant = merchants.get(row.merchant_id);
    if (!merchant) merchants.set(row.merchant_id, row);
    else for (const key of ["merchant", "merchant_domain"]) if ((merchant[key] ?? "").toLowerCase() !== (row[key] ?? "").toLowerCase()) errors.push({ line: row.__line, message: `${key} của merchant ${row.merchant_id} khác dòng ${merchant.__line}` });
    const slugOwner = slugs.get(row.slug);
    if (!slugOwner) slugs.set(row.slug, row);
    else if (slugOwner.product_id !== row.product_id) errors.push({ line: row.__line, message: `slug ${row.slug} đã dùng cho product ${slugOwner.product_id} (dòng ${slugOwner.__line})` });
    const product = products.get(row.product_id);
    if (!product) products.set(row.product_id, row);
    else for (const key of ["slug", "name", "brand", "image_url", "description", "min_weight_kg", "max_weight_kg", "diaper_type", ...SCORE_COLUMNS, "attribute_source", "attribute_verified_at"]) if ((product[key] ?? "") !== (row[key] ?? "")) errors.push({ line: row.__line, message: `${key} của product ${row.product_id} khác dòng ${product.__line}` });
    const variant = variants.get(row.variant_id);
    if (!variant) variants.set(row.variant_id, row);
    else for (const key of ["product_id", "size", "quantity"]) if (variant[key] !== row[key]) errors.push({ line: row.__line, message: `${key} của variant ${row.variant_id} khác dòng ${variant.__line}` });
    const pack = `${row.product_id}|${(row.size ?? "").toUpperCase()}|${row.quantity}`;
    const owner = packs.get(pack);
    if (owner && owner !== row.variant_id) errors.push({ line: row.__line, message: `product ${row.product_id} đã có variant ${owner} cùng size/số miếng` });
    else packs.set(pack, row.variant_id);
  }
  return errors;
}

/** Offers whose price observation is older than the freshness window (spec v1 §10.3); imported as availability 'unknown'. */
export function staleOffers(rows, now = new Date(), maxAgeHours = 48) {
  return rows.filter((row) => !row.__error && now.getTime() - Date.parse(row.price_verified_at) > maxAgeHours * 3_600_000);
}

/** Row-level + cross-row report, sorted by line. */
export function checkCatalog(rows, now = new Date()) {
  const rowErrors = rows.flatMap((row) => validateRow(row, now).map((message) => ({ line: row.__line, message })));
  return [...rowErrors, ...validateCatalog(rows)].sort((a, b) => a.line - b.line);
}
