import { NextResponse } from "next/server";
import { readProductMeta, shopOf, titleFromUrl, type LinkInfo } from "@/lib/inbox/link";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 5_000;

/** Reads at most MAX_BYTES of the body (share tags sit in <head>). */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done || !value) break; chunks.push(value); size += value.length; }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/**
 * POST { url } → { info } for a product link from a known shop. Redirects are followed by hand and must stay on known
 * shops; no cookies, 5 s, 1 MB. A page that hides its price (most marketplaces) returns price: null — the UI asks.
 */
export async function POST(request: Request) {
  if (authConfigured()) { const auth = await authenticated(); if (!auth || auth.user.is_anonymous) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 }); }
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  let url = typeof body?.url === "string" && body.url.length <= 2000 ? body.url.trim() : "";
  const merchant = shopOf(url);
  if (!merchant) return NextResponse.json({ error: "FamAgent chỉ đọc link từ các sàn quen (Shopee, Lazada, Tiki, TikTok Shop, Con Cưng…)." }, { status: 400 });
  const info: LinkInfo = { url, merchant, title: null, price: null };
  try {
    const deadline = AbortSignal.timeout(TIMEOUT_MS);
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetch(url, { redirect: "manual", signal: deadline, headers: { "User-Agent": "Mozilla/5.0 (compatible; FamAgentLinkPreview/1.0)", Accept: "text/html" } });
      const next = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
      if (next) { const target = new URL(next, url).href; if (!shopOf(target)) break; url = target; info.url = target; continue; }
      if (response.ok && (response.headers.get("content-type") ?? "").includes("html")) Object.assign(info, readProductMeta(await readCapped(response)));
      break;
    }
  } catch { /* Timeout or blocked: the family types the name/price instead. */ }
  if (!info.title || /^(shopee|lazada|tiki|tiktok)/i.test(info.title)) info.title = titleFromUrl(info.url) ?? titleFromUrl(url) ?? null;
  return NextResponse.json({ info });
}
