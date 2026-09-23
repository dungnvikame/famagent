import Link from "next/link";
import { getProducts } from "@/lib/catalog/repository";
import { lowestOffer, pricePerPiece } from "@/lib/catalog/filter";
import { vnd } from "@/lib/catalog/format";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ products?: string }> }) {
  const { products: param } = await searchParams;
  const ids = (param ?? "").split(",").filter(Boolean).slice(0, 3);
  const products = (await getProducts()).filter((product) => ids.includes(product.id));
  const price = (product: typeof products[number]) => lowestOffer(product)?.offer.price;
  const unit = (product: typeof products[number]) => { const match = lowestOffer(product); return match ? pricePerPiece(match.offer, match.variant) : null; };
  const cheapest = [...products].sort((a, b) => (unit(a) ?? Infinity) - (unit(b) ?? Infinity))[0];
  const night = [...products].filter((item) => item.diaper.nightUseScore !== undefined).sort((a, b) => (b.diaper.nightUseScore ?? 0) - (a.diaper.nightUseScore ?? 0))[0];
  return <div className="container compare-page"><div className="breadcrumb"><Link href="/shop">Tư vấn</Link><span>/</span>So sánh</div><p className="eyebrow accent">SO SÁNH SẢN PHẨM</p><h1>Điểm khác nhau nằm ở đâu?</h1><p>Giá và thuộc tính lấy từ cùng catalog. Chỗ thiếu dữ liệu được để trống.</p>
    {products.length < 2 ? <div className="empty-state"><h2>Hãy chọn 2–3 sản phẩm để so sánh</h2><Link href="/shop">Quay lại tư vấn</Link></div> : <><div className="compare-summary"><span className="agent-avatar">✳</span><p>{night && night.diaper.nightUseScore && night.diaper.nightUseScore > (cheapest?.diaper.nightUseScore ?? 0) ? `${night.canonicalName} có điểm dùng ban đêm cao hơn trong catalog. ` : ""}{cheapest ? `${cheapest.canonicalName} có giá mỗi miếng thấp nhất trong nhóm này.` : ""} Hãy xem thêm size và khoảng cân nặng trước khi chọn.</p></div><div className="table-scroll"><table className="compare-table"><thead><tr><th>Tiêu chí</th>{products.map((item) => <th key={item.id}><span className="compare-icon">✳</span><strong>{item.canonicalName}</strong><small>{item.brand}</small></th>)}</tr></thead><tbody>
      <tr><th>Giá gói thấp nhất</th>{products.map((item) => <td key={item.id}>{price(item) ? vnd(price(item)!) : "Chưa có thông tin"}</td>)}</tr>
      <tr><th>Giá mỗi miếng</th>{products.map((item) => <td key={item.id}>{unit(item) ? `${vnd(unit(item)!)} / miếng` : "Chưa có thông tin"}</td>)}</tr>
      <tr><th>Khoảng cân nặng</th>{products.map((item) => <td key={item.id}>{item.diaper.minWeightKg}–{item.diaper.maxWeightKg} kg</td>)}</tr>
      <tr><th>Size / số miếng</th>{products.map((item) => <td key={item.id}>{item.variants.map((variant) => `${variant.size} / ${variant.quantity}`).join(", ")}</td>)}</tr>
      <tr><th>Kiểu bỉm</th>{products.map((item) => <td key={item.id}>{item.diaper.type === "pants" ? "Bỉm quần" : "Bỉm dán"}</td>)}</tr>
      <tr><th>Điểm dùng ban đêm</th>{products.map((item) => <td key={item.id}>{item.diaper.nightUseScore ? `${item.diaper.nightUseScore}/5` : "Chưa có thông tin"}</td>)}</tr>
      <tr><th></th>{products.map((item) => <td key={item.id}><Link href={`/products/${item.slug}`}>Xem chi tiết ↗</Link>{lowestOffer(item) && <><br /><Link href={`/go/${lowestOffer(item)!.offer.id}`}>{item.isDemo ? "Bước mua thử" : "Xem nơi bán"} ↗</Link></>}</td>)}</tr>
    </tbody></table></div><p className="compare-disclaimer">{products.some((item) => item.isDemo) ? "Đang so sánh dữ liệu minh họa, không phải báo giá hoặc đánh giá thật." : "Thông tin có thể thay đổi tại nơi bán."}</p></>}
  </div>;
}
