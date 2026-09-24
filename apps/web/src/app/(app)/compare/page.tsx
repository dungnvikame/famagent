import Link from "next/link";
import { CompareSummary } from "@/components/compare-summary";
import { compareTemplate } from "@/lib/ai/shopping/compare-summary";
import { compareToken, resolveCompareItems, type CompareItem } from "@/lib/catalog/compare";
import { AFFILIATE_DISCLOSURE, vnd } from "@/lib/catalog/format";
import { isOfferFresh, priceTimeLabel } from "@/lib/catalog/offer-status";
import { getProducts } from "@/lib/catalog/repository";

const MISSING = "Chưa có thông tin";
const score = (value: number | undefined) => value === undefined ? MISSING : `${value}/5`;

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ items?: string; products?: string }> }) {
  const params = await searchParams;
  const items = resolveCompareItems(await getProducts(), params);
  const now = Date.now();
  const tokens = items.filter((item) => item.offer).map((item) => compareToken(item.product.id, item.variant.id, item.offer!.id)).join(",");
  const rows: Array<[string, (item: CompareItem) => React.ReactNode]> = [
    ["Giá gói", (item) => item.offer ? vnd(item.offer.price) : "Hết hàng hoặc chưa có nơi bán"],
    ["Giá mỗi miếng", (item) => item.unitPrice !== null ? `${vnd(Math.round(item.unitPrice))} / miếng` : MISSING],
    ["Size / số miếng", (item) => `${item.variant.size} / ${item.variant.quantity} miếng`],
    ["Khoảng cân nặng", (item) => `${item.product.diaper.minWeightKg}–${item.product.diaper.maxWeightKg} kg`],
    ["Kiểu bỉm", (item) => item.product.diaper.type === "pants" ? "Bỉm quần" : "Bỉm dán"],
    ["Điểm dùng ban đêm", (item) => score(item.product.diaper.nightUseScore)],
    ["Điểm thấm hút", (item) => score(item.product.diaper.absorbencyScore)],
    ["Độ dày", (item) => score(item.product.diaper.thicknessScore)],
    ["Đánh giá nơi bán", (item) => item.offer?.sellerRating !== undefined ? `${item.offer!.sellerRating}/5` : MISSING],
    ["Nơi bán", (item) => item.offer?.merchantName ?? MISSING],
    ["Giá cập nhật", (item) => !item.offer ? MISSING : item.product.isDemo ? "Giá minh họa" : priceTimeLabel(item.offer.updatedAt)],
  ];
  return <div className="container compare-page"><div className="breadcrumb"><Link href="/shopping">Mua sắm</Link><span>/</span>So sánh</div><p className="eyebrow accent">SO SÁNH SẢN PHẨM</p><h1>Điểm khác nhau nằm ở đâu?</h1><p>So sánh đúng phiên bản và nơi bán đã được gợi ý. Chỗ thiếu dữ liệu ghi “{MISSING}”.</p>
    {items.length < 2 ? <div className="empty-state"><h2>Hãy chọn 2–3 sản phẩm để so sánh</h2><Link href="/agent">Hỏi FamAgent</Link></div> : <>
      <CompareSummary template={compareTemplate(items)} items={tokens} count={items.length}/>
      <div className="table-scroll"><table className="compare-table"><thead><tr><th>Tiêu chí</th>{items.map((item) => <th key={item.product.id}><span className="compare-icon">✳</span><strong>{item.product.canonicalName}</strong><small>{item.product.brand}</small></th>)}</tr></thead><tbody>
        {rows.map(([label, cell]) => <tr key={label}><th>{label}</th>{items.map((item) => <td key={item.product.id}>{cell(item)}</td>)}</tr>)}
        <tr><th></th>{items.map((item) => <td key={item.product.id}><Link href={`/products/${item.product.slug}`}>Xem chi tiết ↗</Link>{item.offer && (isOfferFresh(item.offer, now, item.product.isDemo) ? <><br /><Link href={`/go/${item.offer.id}`}>{item.product.isDemo ? "Bước mua thử" : "Xem nơi bán"} ↗</Link></> : <><br /><span className="stale-note">Giá cũ, đang chờ xác minh</span></>)}</td>)}</tr>
      </tbody></table></div>
      <p className="compare-disclaimer">{items.some((item) => item.product.isDemo) ? "Đang so sánh dữ liệu minh họa, không phải báo giá hoặc đánh giá thật. " : "Giá sản phẩm chưa gồm phí giao và có thể thay đổi tại nơi bán. "}{AFFILIATE_DISCLOSURE}</p>
    </>}
  </div>;
}
