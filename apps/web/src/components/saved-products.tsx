"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/catalog/types";
import { getSavedProducts } from "@/lib/experience/storage";
import { cloudEnabled, loadCloudSaved } from "@/lib/experience/cloud";

/** Saved list; `embedded` renders inside the Shopping page (no own heading). */
export function SavedProducts({ embedded = false }: { embedded?: boolean }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => { async function load() { const [response, ids] = await Promise.all([fetch("/api/products"), cloudEnabled ? loadCloudSaved() : Promise.resolve(getSavedProducts())]); const data = await response.json() as { products: Product[] }; setProducts(data.products.filter((item) => ids.includes(item.id))); } void load().catch(() => setProducts([])); }, []);
  const body = products === null ? <p className="app-sub" aria-busy="true">Đang tải…</p> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <div className="app-card app-empty"><strong>Bạn chưa lưu sản phẩm nào</strong><p style={{ margin: 0 }}>Trong lúc trò chuyện, chọn biểu tượng trái tim trên sản phẩm muốn xem lại.</p><Link className="app-btn ghost" href="/agent">Hỏi FamAgent →</Link></div>;
  if (embedded) return body;
  return <div className="container saved-page"><h1>Sản phẩm đã lưu</h1>{body}</div>;
}
