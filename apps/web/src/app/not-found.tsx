import Link from "next/link";
export default function NotFound() { return <div className="container empty-state" style={{ marginTop: 80, marginBottom: 80 }}><h1>Không tìm thấy trang</h1><p>Trang này không tồn tại hoặc đã được gỡ.</p><Link href="/home">Về Trang chủ</Link></div>; }

