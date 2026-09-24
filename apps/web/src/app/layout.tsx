import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE_DISCLOSURE } from "@/lib/catalog/format";
import { AccountNav } from "@/components/account-nav";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./experience.css";
import "./agent-workspace.css";
import "./onboarding-agent.css";
// Soft Aurora layer must load last (tokens + glass surfaces override component files).
import "./aurora.css";
import "./landing.css";
import "./onboarding-wizard.css";

// Self-hosted at build time by next/font (no runtime request to Google); Vietnamese subset included.
const sans = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "FamAgent | Chọn đồ cho gia đình",
  description: "Khám phá và lọc sản phẩm phù hợp cho gia đình.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" className={sans.variable}><body>
    <header className="site-header"><div className="container nav">
      <Link href="/" className="brand"><span className="brand-icon">f.</span> FamAgent</Link>
      <nav aria-label="Điều hướng chính"><Link href="/products">Khám phá</Link><Link href="/saved">Đã lưu</Link><Link href="/family">Gia đình</Link><AccountNav /><Link className="nav-cta" href="/onboarding">Tư vấn ngay</Link></nav>
    </div></header>
    <main>{children}</main>
    <footer className="site-footer"><div className="container"><strong>FamAgent</strong><p>{AFFILIATE_DISCLOSURE} Giá sản phẩm chưa gồm phí giao và có thể thay đổi tại nơi bán.</p></div></footer>
  </body></html>;
}
