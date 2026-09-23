import Link from "next/link";
export default function NotFound() { return <div className="container empty-state" style={{ marginTop: 80, marginBottom: 80 }}><h1>Không tìm thấy sản phẩm</h1><p>Sản phẩm có thể đã được gỡ khỏi catalog.</p><Link href="/products">Về danh sách sản phẩm</Link></div>; }

