// Product links in the Inbox (core journey spec §2C, with the 24/09 decision): read the page's share tags when the shop
// serves them, never scrape against the shop's terms, and ask for the price when it is not in the page.

/** Shops FamAgent will fetch a link from (and follow redirects within). Anything else is refused (no open proxy). */
const SHOP_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)shopee\.vn$|(^|\.)shp\.ee$/, "Shopee"], [/(^|\.)lazada\.vn$/, "Lazada"], [/(^|\.)tiki\.vn$/, "Tiki"],
  [/(^|\.)tiktok\.com$/, "TikTok Shop"], [/(^|\.)concung\.com$/, "Con Cưng"], [/(^|\.)bibomart\.com\.vn$/, "Bibo Mart"],
  [/(^|\.)kidsplaza\.vn$/, "Kids Plaza"], [/(^|\.)bachhoaxanh\.com$/, "Bách Hóa Xanh"], [/(^|\.)winmart\.vn$/, "WinMart"],
  [/(^|\.)dienmayxanh\.com$/, "Điện máy Xanh"], [/(^|\.)thegioididong\.com$/, "Thế Giới Di Động"], [/(^|\.)fptshop\.com\.vn$/, "FPT Shop"],
];

export function shopOf(url: string): string | null {
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? SHOP_HOSTS.find(([pattern]) => pattern.test(parsed.hostname))?.[1] ?? null : null; }
  catch { return null; }
}

export interface LinkInfo { url: string; merchant: string; title: string | null; price: number | null }

const decode = (text: string) => text.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).trim();
const meta = (html: string, name: string) => {
  const tag = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*>`, "i").exec(html)?.[0];
  return tag ? /content=["']([^"']*)["']/i.exec(tag)?.[1] ?? null : null;
};
const toPrice = (value: string | null | undefined) => { if (!value) return null; const number = Math.round(Number(value.replace(/[^\d.]/g, ""))); return number >= 1000 && number <= 1_000_000_000 ? number : null; };

/** Title and price from Open Graph / product meta / JSON-LD; null when the page does not say. */
export function readProductMeta(html: string): { title: string | null; price: number | null } {
  const title = meta(html, "og:title") ?? /<title[^>]*>([^<]{3,300})<\/title>/i.exec(html)?.[1] ?? null;
  const ld = /"price"\s*:\s*"?(\d[\d.]*)"?/i.exec(html)?.[1];
  const price = toPrice(meta(html, "product:price:amount")) ?? toPrice(meta(html, "og:price:amount")) ?? toPrice(meta(html, "price")) ?? toPrice(ld);
  return { title: title ? decode(title).replace(/\s*[|–-]\s*(Shopee|Lazada|Tiki|TikTok).*$/i, "").slice(0, 200) : null, price };
}

/** Shop URLs usually carry the product name in the path ("/Bim-quan-Merries-L44-i.123.456"); used when the page hides it. */
export function titleFromUrl(url: string): string | null {
  try {
    const segment = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "");
    const name = segment.replace(/-i\.\d+\.\d+$/, "").replace(/\.html?$/, "").replace(/-p?\d{5,}$/, "").replace(/[-_]+/g, " ").trim();
    return /[a-zA-ZÀ-ỹ]{3}/.test(name) && name.split(" ").length >= 2 ? name.slice(0, 200) : null;
  } catch { return null; }
}
