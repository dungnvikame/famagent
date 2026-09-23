import Link from "next/link";
import Image from "next/image";
import { lowestMatchingOffer, pricePerPiece } from "@/lib/catalog/filter";
import { vnd } from "@/lib/catalog/format";
import type { CatalogFilters, Product } from "@/lib/catalog/types";

export function ProductCard({ product, filters = {} }: { product: Product; filters?: CatalogFilters }) {
  const match = lowestMatchingOffer(product, filters);
  return <article className="product-card">
    <div className="product-visual">
      {product.imageUrl ? <Image unoptimized src={product.imageUrl} alt={product.canonicalName} width={400} height={300} /> : <span aria-hidden="true">✳</span>}
      {product.isDemo && <span className="demo-tag">DỮ LIỆU MẪU</span>}
    </div>
    <div className="product-body">
      <p className="eyebrow">{product.brand}</p>
      <h3><Link href={`/products/${product.slug}`}>{product.canonicalName}</Link></h3>
      <div className="product-facts"><span>{product.diaper.minWeightKg}–{product.diaper.maxWeightKg} kg</span><span>{product.diaper.type === "pants" ? "Bỉm quần" : "Bỉm dán"}</span></div>
      {match ? <><p className="price">{vnd(match.offer.price)} <span>/ {match.variant.quantity} miếng</span></p><p className="unit-price">{vnd(pricePerPiece(match.offer, match.variant) ?? 0)} / miếng</p></> : <p>Chưa có nơi bán</p>}
      <Link className="text-link" href={`/products/${product.slug}`}>Xem sản phẩm <span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}
