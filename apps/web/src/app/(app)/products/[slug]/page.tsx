import Link from "next/link";
import Image from "next/image";
import { DiaperIllustration } from "@/components/diaper-illustration";
import { notFound } from "next/navigation";
import { availableOffers, pricePerPiece } from "@/lib/catalog/filter";
import { AFFILIATE_DISCLOSURE, vnd } from "@/lib/catalog/format";
import { getProductBySlug } from "@/lib/catalog/repository";
import { isOfferFresh, priceTimeLabel } from "@/lib/catalog/offer-status";

export default async function ProductDetail({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ price?: string }> }) {
  const { slug } = await params;
  const { price } = await searchParams;
  const now = Date.now();
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return <div className="container detail-page"><div className="breadcrumb"><Link href="/home">Trang chủ</Link><span>/</span><Link href="/shopping">Mua sắm</Link><span>/</span>{product.canonicalName}</div>
    {price === "stale" && <div className="notice"><strong>Giá của nơi bán này đã quá 48 giờ chưa được xác minh lại.</strong> Chúng tôi tạm ẩn nút mua cho tới khi cập nhật giá.</div>}
    {product.isDemo && <div className="notice"><strong>Dữ liệu minh họa.</strong> Sản phẩm, giá và nơi bán dưới đây không phải thông tin thương mại thực tế.</div>}
    <div className="detail-grid"><div className="detail-visual">{product.imageUrl ? <Image unoptimized src={product.imageUrl} alt={product.canonicalName} width={700} height={600} /> : <DiaperIllustration />}</div><div className="detail-info"><p className="eyebrow accent">{product.brand}</p><h1>{product.canonicalName}</h1><p>{product.description}</p><div className="spec-list"><div><span>Cân nặng phù hợp</span><strong>{product.diaper.minWeightKg}–{product.diaper.maxWeightKg} kg</strong></div><div><span>Kiểu bỉm</span><strong>{product.diaper.type === "pants" ? "Bỉm quần" : "Bỉm dán"}</strong></div>{product.diaper.nightUseScore && <div><span>Điểm dùng ban đêm</span><strong>{product.diaper.nightUseScore}/5</strong></div>}</div></div></div>
    <section className="offers"><h2>Phiên bản và giá bán</h2><p>Giá mỗi miếng = giá gói ÷ số miếng. Giá được cập nhật theo nguồn dữ liệu catalog; giá quá 48 giờ chưa xác minh sẽ tạm ẩn nút mua.</p><div className="offer-list">{product.variants.map((variant) => <div className="offer-row" key={variant.id}><div><strong>{variant.name}</strong><span>Size {variant.size} · {variant.quantity} miếng</span></div>{availableOffers(variant).length ? availableOffers(variant).map((offer) => <div className="offer-price" key={offer.id}><strong>{vnd(offer.price)}</strong><span>{vnd(pricePerPiece(offer, variant) ?? 0)} / miếng · {offer.merchantName}</span><span>{product.isDemo ? "Giá minh họa" : `Giá cập nhật ${priceTimeLabel(offer.updatedAt)}`} · chưa gồm phí giao</span>{isOfferFresh(offer, now, product.isDemo) ? <Link className="merchant-link" href={`/go/${offer.id}`}>{product.isDemo ? "Xem bước mua thử" : "Xem nơi bán"} ↗</Link> : <span className="stale-note">Giá cũ, đang chờ xác minh</span>}</div>) : <span>Chưa có nơi bán</span>}</div>)}</div><p className="fine-print">{AFFILIATE_DISCLOSURE}</p></section>
  </div>;
}
