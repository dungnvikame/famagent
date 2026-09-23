import { NextResponse } from "next/server";
import pg from "pg";
import { decideRedirect } from "@/lib/catalog/offer-status";
import { authenticated, authConfigured } from "@/lib/supabase/server";

// GET /go/:offerId (spec v1 §17): destination comes only from the DB, never from the client; the click is
// recorded before redirecting. Stale prices (>48h) go to the product page instead of the merchant.
export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  if (offerId.length > 100) return NextResponse.json({ error: "Offer không hợp lệ" }, { status: 400 });
  if (offerId.startsWith("demo-offer-")) return NextResponse.redirect(new URL(`/demo-offer?offer=${encodeURIComponent(offerId)}`, request.url), 302);
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Nơi bán chưa được cấu hình" }, { status: 503 });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query<{ product_id: string; product_slug: string; merchant_id: string; domain: string | null; affiliate_url: string | null; updated_at: Date }>(
      `select p.id as product_id, p.slug as product_slug, o.merchant_id, m.domain, o.affiliate_url, o.updated_at
       from public.product_offers o
       join public.product_variants v on v.id=o.product_variant_id
       join public.products p on p.id=v.product_id
       join public.merchants m on m.id=o.merchant_id
       where o.id=$1 and o.availability='in_stock' and p.published=true`, [offerId]);
    const offer = result.rows[0];
    const decision = decideRedirect(offer && { productSlug: offer.product_slug, domain: offer.domain, affiliateUrl: offer.affiliate_url, updatedAt: offer.updated_at });
    if (decision.kind === "missing") return NextResponse.json({ error: "Không tìm thấy offer" }, { status: 404 });
    if (decision.kind === "invalid") return NextResponse.json({ error: "Liên kết không hợp lệ" }, { status: 400 });
    if (decision.kind === "stale") return NextResponse.redirect(new URL(`/products/${encodeURIComponent(decision.productSlug)}?price=stale`, request.url), 302);
    const sessionId = new URL(request.url).searchParams.get("session")?.slice(0, 100) || null;
    const account = authConfigured() ? await authenticated() : null;
    await client.query("insert into public.affiliate_clicks(user_id,session_id,product_id,offer_id,merchant_id,destination_url) values ($1,$2,$3,$4,$5,$6)", [account?.user.id ?? null, sessionId, offer.product_id, offerId, offer.merchant_id, decision.url.toString()]);
    return NextResponse.redirect(decision.url, 302);
  } catch { return NextResponse.json({ error: "Chưa thể mở nơi bán" }, { status: 503 }); }
  finally { await client.end(); }
}
