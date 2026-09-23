import { NextResponse } from "next/server";
import pg from "pg";
import { authenticated, authConfigured } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  if (offerId.length > 100) return NextResponse.json({ error: "Offer không hợp lệ" }, { status: 400 });
  if (offerId.startsWith("demo-offer-")) return NextResponse.redirect(new URL(`/demo-offer?offer=${encodeURIComponent(offerId)}`, request.url), 302);
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Nơi bán chưa được cấu hình" }, { status: 503 });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query<{ product_id: string; merchant_id: string; domain: string | null; affiliate_url: string | null }>(
      `select p.id as product_id, o.merchant_id, m.domain, o.affiliate_url
       from public.product_offers o
       join public.product_variants v on v.id=o.product_variant_id
       join public.products p on p.id=v.product_id
       join public.merchants m on m.id=o.merchant_id
       where o.id=$1 and o.availability='in_stock' and p.published=true`, [offerId]);
    const offer = result.rows[0];
    if (!offer?.affiliate_url || !offer.domain) return NextResponse.json({ error: "Không tìm thấy offer" }, { status: 404 });
    const destination = new URL(offer.affiliate_url);
    const host = destination.hostname.toLowerCase(); const domain = offer.domain.toLowerCase();
    if (destination.protocol !== "https:" || (host !== domain && !host.endsWith(`.${domain}`))) return NextResponse.json({ error: "Liên kết không hợp lệ" }, { status: 400 });
    const sessionId = new URL(request.url).searchParams.get("session")?.slice(0, 100) || null;
    const account = authConfigured() ? await authenticated() : null;
    await client.query("insert into public.affiliate_clicks(user_id,session_id,product_id,offer_id,merchant_id,destination_url) values ($1,$2,$3,$4,$5,$6)", [account?.user.id ?? null, sessionId, offer.product_id, offerId, offer.merchant_id, destination.toString()]);
    return NextResponse.redirect(destination, 302);
  } catch { return NextResponse.json({ error: "Chưa thể mở nơi bán" }, { status: 503 }); }
  finally { await client.end(); }
}
