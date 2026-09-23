import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { availableOffers, pricePerPiece } from "@/lib/catalog/filter";
import { vnd } from "@/lib/catalog/format";
import { getProductBySlug } from "@/lib/catalog/repository";

export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return <div className="container detail-page"><div className="breadcrumb"><Link href="/">Trang chủ</Link><span>/</span><Link href="/products">Bỉm cho bé</Link><span>/</span>{product.canonicalName}</div>
    {product.isDemo && <div className="notice"><strong>Dữ liệu minh họa.</strong> Sản phẩm, giá và nơi bán dưới đây không phải thông tin thương mại thực tế.</div>}
    <div className="detail-grid"><div className="detail-visual">{product.imageUrl ? <Image unoptimized src={product.imageUrl} alt={product.canonicalName} width={700} height={600} /> : <span aria-hidden="true">✳</span>}</div><div className="detail-info"><p className="eyebrow accent">{product.brand}</p><h1>{product.canonicalName}</h1><p>{product.description}</p><div className="spec-list"><div><span>Cân nặng phù hợp</span><strong>{product.diaper.minWeightKg}–{product.diaper.maxWeightKg} kg</strong></div><div><span>Kiểu bỉm</span><strong>{product.diaper.type === "pants" ? "Bỉm quần" : "Bỉm dán"}</strong></div>{product.diaper.nightUseScore && <div><span>Điểm dùng ban đêm</span><strong>{product.diaper.nightUseScore}/5</strong></div>}</div></div></div>
    <section className="offers"><h2>Phiên bản và giá bán</h2><p>Giá mỗi miếng = giá gói ÷ số miếng. Giá được cập nhật theo nguồn dữ liệu catalog.</p><div className="offer-list">{product.variants.map((variant) => <div className="offer-row" key={variant.id}><div><strong>{variant.name}</strong><span>Size {variant.size} · {variant.quantity} miếng</span></div>{availableOffers(variant).length ? availableOffers(variant).map((offer) => <div className="offer-price" key={offer.id}><strong>{vnd(offer.price)}</strong><span>{vnd(pricePerPiece(offer, variant) ?? 0)} / miếng · {offer.merchantName}</span><Link className="merchant-link" href={`/go/${offer.id}`}>{product.isDemo ? "Xem bước mua thử" : "Xem nơi bán"} ↗</Link></div>) : <span>Chưa có nơi bán</span>}</div>)}</div><p className="fine-print">Family AI có thể nhận hoa hồng khi bạn mua qua một số liên kết. Hoa hồng không ảnh hưởng thứ tự gợi ý.</p></section>
  </div>;
}
