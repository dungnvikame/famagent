import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SavedProducts } from "@/components/saved-products";
import { filterProducts, parseFilters } from "@/lib/catalog/filter";
import { getProducts, isDemoMode } from "@/lib/catalog/repository";

export const metadata = { title: "FamAgent | Tìm & so sánh" };

type Search = Record<string, string | string[] | undefined>;
/** Catalog search + compare + saved (spec v1). Reached from a household item ("Tìm lựa chọn khác") or the agent, not as the Shopping home. */
export default async function FindPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  const filters = parseFilters(query);
  const all = await getProducts();
  const products = filterProducts(all, filters);
  const brands = [...new Set(all.map((product) => product.brand))].sort();
  return <div className="container catalog-page">
    <div className="page-heading"><div><h1>Tìm & so sánh</h1><p>Chọn bỉm hợp cân nặng của bé và mức giá bạn muốn. <Link href="/shopping">← Kế hoạch mua sắm</Link></p></div><span className="count-pill">{products.length} sản phẩm</span></div>
    {isDemoMode() && <div className="notice"><strong>Đang xem dữ liệu minh họa.</strong> Tên, thông số và giá chỉ để thử giao diện. Chưa có liên kết mua hàng.</div>}
    <div className="catalog-layout"><aside className="filter-panel"><h2>Lọc sản phẩm</h2><form action="/shopping/find" method="get">
      <label>Cân nặng của bé (kg)<input name="weightKg" type="number" min="1" max="30" step="0.1" placeholder="Ví dụ: 10" defaultValue={filters.weightKg ?? ""} /></label>
      <label>Kích cỡ<select name="size" defaultValue={filters.size ?? ""}><option value="">Tất cả size</option>{["NB", "S", "M", "L", "XL", "XXL"].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Giá tối đa (đ)<input name="maxPrice" type="number" min="1" step="1000" placeholder="Ví dụ: 400000" defaultValue={filters.maxPrice ?? ""} /></label>
      <label>Thương hiệu<select name="brand" defaultValue={filters.brand ?? ""}><option value="">Tất cả thương hiệu</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
      <button className="button primary full" type="submit">Áp dụng bộ lọc</button><Link className="clear-link" href="/shopping/find">Xóa bộ lọc</Link>
    </form></aside><section className="results" aria-label="Danh sách sản phẩm"><div className="results-heading"><h2>Sản phẩm phù hợp</h2><p>Sắp xếp theo giá gói thấp nhất đang có hàng</p></div>
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} filters={filters} />)}</div> : <div className="empty-state"><h3>Chưa có sản phẩm phù hợp</h3><p>Thử mở rộng mức giá hoặc bỏ một bộ lọc.</p><Link href="/shopping/find">Xem tất cả sản phẩm</Link></div>}
    </section></div>
    <section className="app-section" id="saved" aria-labelledby="find-saved"><h2 id="find-saved">Đã lưu</h2><SavedProducts embedded /></section>
  </div>;
}

