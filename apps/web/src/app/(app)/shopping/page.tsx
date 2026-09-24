import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SavedProducts } from "@/components/saved-products";
import { filterProducts, parseFilters } from "@/lib/catalog/filter";
import { getProducts, isDemoMode } from "@/lib/catalog/repository";

export const metadata = { title: "FamAgent | Mua sắm" };

type Search = Record<string, string | string[] | undefined>;
const TABS = [{ id: "search", label: "Tìm & so sánh" }, { id: "saved", label: "Đã lưu" }, { id: "tracking", label: "Đang theo dõi" }] as const;
type Tab = (typeof TABS)[number]["id"];

/** Shopping (spec v2 §13, §37): search/compare now; saved list; consumption tracking + purchase history arrive with the cross-module phase. */
export default async function ShoppingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const tab: Tab = TABS.some((item) => item.id === params.tab) ? params.tab as Tab : "search";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string" && key !== "tab") query.set(key, value);
  const filters = parseFilters(query);
  const all = await getProducts();
  const products = filterProducts(all, filters);
  const brands = [...new Set(all.map((product) => product.brand))].sort();
  const tabs = <div className="app-tabs" role="tablist">{TABS.map((item) => <Link key={item.id} role="tab" aria-selected={item.id === tab} className={item.id === tab ? "on" : undefined} href={item.id === "search" ? "/shopping" : `/shopping?tab=${item.id}`}>{item.label}</Link>)}</div>;
  if (tab === "saved") return <div className="app-page"><div className="app-page-head"><div><h1>Mua sắm</h1><p className="app-sub">Sản phẩm bạn đánh dấu để xem lại.</p></div></div>{tabs}<SavedProducts embedded /></div>;
  if (tab === "tracking") return <div className="app-page"><div className="app-page-head"><div><h1>Mua sắm</h1><p className="app-sub">Đồ tiêu hao và ước tính còn bao nhiêu ngày.</p></div></div>{tabs}<div className="app-card app-empty"><strong>Chưa theo dõi món nào</strong><p style={{ margin: 0 }}>Khi bạn đánh dấu “đã mua” một sản phẩm, FamAgent sẽ ghi vào Tiền, ước tính ngày hết và nhắc mua lại trên Trang chủ.</p><Link className="app-btn ghost" href="/agent">Hỏi FamAgent tìm đồ →</Link></div></div>;
  return <div className="container catalog-page">
    <div className="page-heading"><div><h1>Mua sắm</h1><p>Tìm lựa chọn phù hợp với bé và mức giá bạn muốn. Đang có: bỉm cho bé.</p></div><span className="count-pill">{products.length} sản phẩm</span></div>
    {tabs}
    {isDemoMode() && <div className="notice"><strong>Đang xem dữ liệu minh họa.</strong> Tên, thông số và giá chỉ để thử giao diện. Chưa có liên kết mua hàng.</div>}
    <div className="catalog-layout"><aside className="filter-panel"><h2>Lọc sản phẩm</h2><form action="/shopping" method="get">
      <label>Cân nặng của bé (kg)<input name="weightKg" type="number" min="1" max="30" step="0.1" placeholder="Ví dụ: 10" defaultValue={filters.weightKg ?? ""} /></label>
      <label>Kích cỡ<select name="size" defaultValue={filters.size ?? ""}><option value="">Tất cả size</option>{["NB", "S", "M", "L", "XL", "XXL"].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Giá tối đa (đ)<input name="maxPrice" type="number" min="1" step="1000" placeholder="Ví dụ: 400000" defaultValue={filters.maxPrice ?? ""} /></label>
      <label>Thương hiệu<select name="brand" defaultValue={filters.brand ?? ""}><option value="">Tất cả thương hiệu</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
      <button className="button primary full" type="submit">Áp dụng bộ lọc</button><Link className="clear-link" href="/shopping">Xóa bộ lọc</Link>
    </form></aside><section className="results" aria-label="Danh sách sản phẩm"><div className="results-heading"><h2>Sản phẩm phù hợp</h2><p>Sắp xếp theo giá gói thấp nhất đang có hàng</p></div>
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} filters={filters} />)}</div> : <div className="empty-state"><h3>Chưa có sản phẩm phù hợp</h3><p>Thử mở rộng mức giá hoặc bỏ một bộ lọc.</p><Link href="/shopping">Xem tất cả sản phẩm</Link></div>}
    </section></div>
  </div>;
}

