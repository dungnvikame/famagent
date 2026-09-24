"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAgent, IconBag, IconFamily, IconHome, IconMoney } from "./nav-icons";
import { useAccount } from "./use-account";
import { Inbox } from "@/components/inbox/inbox";

/** Spec v2 §34: Home · Money · Shopping · Agent · Family. Same order on the desktop sidebar and the phone bottom bar. */
export const SECTIONS = [
  { href: "/home", label: "Trang chủ", icon: IconHome, match: /^\/home/ },
  { href: "/money", label: "Tiền", icon: IconMoney, match: /^\/money/ },
  { href: "/shopping", label: "Mua sắm", icon: IconBag, match: /^\/(shopping|products|compare)/ },
  { href: "/agent", label: "Trợ lý", icon: IconAgent, match: /^\/agent/ },
  { href: "/family", label: "Gia đình", icon: IconFamily, match: /^\/family/ },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const account = useAccount();
  const items = SECTIONS.map((section) => {
    const active = section.match.test(pathname);
    const Icon = section.icon;
    return <Link key={section.href} href={section.href} className={active ? "on" : undefined} aria-current={active ? "page" : undefined}><Icon />{section.label}</Link>;
  });
  const initial = (account.name ?? account.email ?? "?").trim().charAt(0).toUpperCase();
  return <div className="app-shell">
    <aside className="app-side">
      <Link href="/home" className="app-brand"><span className="app-orb" aria-hidden="true" />FamAgent</Link>
      <nav className="app-nav" aria-label="Điều hướng chính">{items}</nav>
      <Inbox />
      <Link href="/family#account" className="app-me" aria-label="Tài khoản & quyền riêng tư">
        {/* eslint-disable-next-line @next/next/no-img-element -- Google avatar; remote host not whitelisted for next/image */}
        {account.avatarUrl ? <img src={account.avatarUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" /> : <span className="app-me-initial" aria-hidden="true">{account.status === "loading" ? "" : initial}</span>}
        <span><b>{account.status === "member" ? account.name : account.status === "guest" ? "Khách" : account.status === "local" ? "Bản thử" : "…"}</b><small>{account.status === "member" ? "Tài khoản & quyền riêng tư" : account.status === "guest" ? "Chưa đăng nhập" : " "}</small></span>
      </Link>
    </aside>
    <div className="app-main">{children}</div>
    <nav className="app-bottom" aria-label="Điều hướng chính">{items}</nav>
  </div>;
}
