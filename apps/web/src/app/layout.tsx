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
// Signed-in shell (5 sections) — last so it can override the legacy agent layout.
import "./app-shell.css";
import "./money.css";
import "./money-frameworks.css";
import "./financial-health.css";
import "./family-notes.css";

// Self-hosted at build time by next/font (no runtime request to Google); Vietnamese subset included.
const sans = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "FamAgent | Gia đình vận hành nhẹ nhàng hơn",
  description: "FamAgent nhớ, theo dõi và gợi ý việc cần làm cho gia đình: tiền, mua sắm và những điều dễ quên.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" className={sans.variable}><body>
    <header className="site-header"><div className="container nav">
      <Link href="/" className="brand"><span className="brand-icon">f.</span> FamAgent</Link>
      {/* Public header (landing, onboarding, sign-in). Signed-in pages hide it and use the app shell. */}
      <nav aria-label="Điều hướng chính"><AccountNav /><Link className="nav-cta" href="/onboarding">Bắt đầu miễn phí</Link></nav>
    </div></header>
    <main>{children}</main>
    <footer className="site-footer"><div className="container"><strong>FamAgent</strong><p>{AFFILIATE_DISCLOSURE} Giá sản phẩm chưa gồm phí giao và có thể thay đổi tại nơi bán.</p></div></footer>
  </body></html>;
}
