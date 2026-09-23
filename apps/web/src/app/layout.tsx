import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "./globals.css";
import "./experience.css";
import "./agent-workspace.css";
import "./onboarding-agent.css";

export const metadata: Metadata = {
  title: "Family AI | Chọn đồ cho gia đình",
  description: "Khám phá và lọc sản phẩm phù hợp cho gia đình.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>
    <header className="site-header"><div className="container nav">
      <Link href="/" className="brand"><span className="brand-icon">f.</span> Family AI</Link>
      <nav aria-label="Điều hướng chính"><Link href="/shop">Tư vấn</Link><Link href="/products">Khám phá</Link><Link href="/saved">Đã lưu</Link><Link href="/family">Gia đình</Link></nav>
    </div></header>
    <main>{children}</main>
    <footer className="site-footer"><div className="container"><strong>Family AI</strong><p>Bản trải nghiệm với dữ liệu minh họa. Giá và thông số sản phẩm cần được xác minh trước khi công bố.</p></div></footer>
  </body></html>;
}
