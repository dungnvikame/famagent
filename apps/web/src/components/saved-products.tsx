"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/catalog/types";
import { getSavedProducts } from "@/lib/experience/storage";
import { cloudEnabled, loadCloudSaved } from "@/lib/experience/cloud";

export function SavedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { async function load() { const [response, ids] = await Promise.all([fetch("/api/products"), cloudEnabled ? loadCloudSaved() : Promise.resolve(getSavedProducts())]); const data = await response.json() as { products: Product[] }; setProducts(data.products.filter((item) => ids.includes(item.id))); } void load().catch(() => setProducts([])); }, []);
  return <div className="container saved-page"><div className="breadcrumb"><Link href="/shop">Tư vấn</Link><span>/</span>Đã lưu</div><p className="eyebrow accent">DANH SÁCH CỦA BẠN</p><h1>Sản phẩm đã lưu</h1>{products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <div className="empty-state"><h2>Bạn chưa lưu sản phẩm nào</h2><p>Trong lúc tư vấn, chọn biểu tượng trái tim trên sản phẩm muốn xem lại.</p><Link href="/shop">Bắt đầu tư vấn →</Link></div>}</div>;
}
