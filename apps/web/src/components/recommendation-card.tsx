"use client";

import Image from "next/image";
import { pricePerPiece } from "@/lib/catalog/filter";
import { vnd } from "@/lib/catalog/format";
import { isOfferFresh, priceTimeLabel } from "@/lib/catalog/offer-status";
import type { ProductOffer } from "@/lib/catalog/types";
import type { Recommendation } from "@/lib/experience/types";
import { trackEvent } from "@/lib/experience/storage";

interface Props { item: Recommendation; /** Current catalog copy of the offer; null = catalog loaded and the offer is no longer in stock. */ liveOffer?: ProductOffer | null; rank: number; saved: boolean; comparing: boolean; compareFull: boolean; conversationId: string; onSave: () => void; onDetails: () => void; onCompare: () => void }

/** Recommendation card (spec §10, §48, v1 §11.5): no %, "Phù hợp nhất" not "tốt nhất", sourced reasons only. */
export function RecommendationCard({ item, liveOffer, rank, saved, comparing, compareFull, conversationId, onSave, onDetails, onCompare }: Props) {
  const variant = item.product.variants.find((entry) => entry.id === item.variantId);
  // Conversations are stored with the offer as it was; prefer the current catalog copy so a re-verified price keeps its CTA.
  const storedOffer = variant?.offers.find((entry) => entry.id === item.offerId);
  const offer = liveOffer ?? storedOffer;
  if (!variant || !offer) return null;
  const demo = Boolean(item.product.isDemo);
  const gone = liveOffer === null;
  const fresh = !gone && isOfferFresh(offer, Date.now(), demo);
  const unit = pricePerPiece(offer, variant);
  // Conversations saved before spec v1 may lack the newer arrays.
  const tradeoffs = [...(item.tradeoffs ?? (item.tradeoff ? [item.tradeoff] : [])), ...(item.failedSoftPreferences ?? []).map((label) => `Chưa đạt mức mong muốn về ${label}`)];
  return <article className="agent-product">
    <div className="agent-product-top"><span>{rank === 1 ? "PHÙ HỢP NHẤT" : `LỰA CHỌN ${rank}`}</span><button onClick={onSave} aria-label={saved ? "Bỏ lưu sản phẩm" : "Lưu sản phẩm"}>{saved ? "♥" : "♡"}</button></div>
    <div className="agent-product-visual">{item.product.imageUrl ? <Image unoptimized src={item.product.imageUrl} alt={item.product.canonicalName} width={240} height={120} /> : <span aria-hidden="true">✳</span>}</div>
    <div className="agent-product-main">
      <small>{item.product.brand}</small>
      <h3>{item.product.canonicalName}</h3>
      <p className="agent-product-score">Phù hợp với nhu cầu đã nêu</p>
      <ul>{item.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
      <p className="agent-product-price">{vnd(offer.price)} <span>· {variant.quantity} miếng{unit ? ` · ${vnd(Math.round(unit))}/miếng` : ""}</span></p>
      <p className="agent-offer-meta">{offer.merchantName} · {demo ? "giá minh họa" : `giá cập nhật ${priceTimeLabel(offer.updatedAt)}`} · {offer.shippingEstimate ? `giao ${offer.shippingEstimate}` : "chưa gồm phí giao"}</p>
      <details className="agent-why">
        <summary>Vì sao gợi ý này?</summary>
        <p className="agent-why-title">Khớp vì</p>
        <ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        {tradeoffs.length > 0 && <><p className="agent-why-title">Đánh đổi</p><ul className="agent-why-tradeoffs">{tradeoffs.map((line) => <li key={line}>{line}</li>)}</ul></>}
      </details>
      <div className="agent-product-actions">
        <button onClick={onCompare} aria-pressed={comparing} disabled={!comparing && compareFull} title={!comparing && compareFull ? "So sánh tối đa 3 sản phẩm" : undefined}>{comparing ? "✓ Đang so sánh" : "So sánh"}</button>
        <button onClick={onDetails}>Chi tiết</button>
        {fresh
          ? <a href={`/go/${offer.id}?session=${encodeURIComponent(conversationId)}`} onClick={() => trackEvent("offer_clicked", { offerId: offer.id, productId: item.product.id, rank })}>{demo ? "Mua thử" : "Xem nơi bán"} ↗</a>
          : <span className="agent-stale" title={gone ? "Nơi bán này hiện không còn hàng" : "Giá quá 48 giờ chưa được xác minh lại"}>{gone ? "Hết hàng" : "Giá cũ"}</span>}
      </div>
    </div>
  </article>;
}
