"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app-shell/use-account";
import { buildBrief, type FamilyBrief } from "@/lib/brief/build-brief";
import { cloudEnabled, loadCloudConversations, loadCloudProfile, loadCloudSaved } from "@/lib/experience/cloud";
import { getConversations, getProfile, getSavedProducts } from "@/lib/experience/storage";
import type { Conversation, FamilyProfile } from "@/lib/experience/types";
import { formatWeight } from "@/lib/onboarding/questions";
import { loadMoney } from "@/lib/money/client";
import { monthKey, shortVnd, summarizeMonth, type MonthSummary } from "@/lib/money/summary";
import { loadPurchases } from "@/lib/shopping/purchase-client";
import { estimateStock, type StockEstimate } from "@/lib/shopping/purchases";
import { rateResolver } from "@/components/shopping/tracking-list";
import { DailyTasks } from "./daily-tasks";
import { localDay } from "@/lib/brief/daily-tasks";

/** Home = Family Brief (spec v2 §16): what needs attention first, then Money · Shopping · insights. Never opens into chat. */
export function FamilyBriefPage() {
  const router = useRouter();
  const account = useAccount();
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [money, setMoney] = useState<MonthSummary | null>(null);
  const [loggedToday, setLoggedToday] = useState(false);
  const [stock, setStock] = useState<StockEstimate[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [family, existing, saved] = cloudEnabled
          ? await Promise.all([loadCloudProfile(), loadCloudConversations(), loadCloudSaved()])
          : [getProfile(), getConversations(), getSavedProducts()];
        if (cancelled) return;
        if (!family?.onboardedAt) { router.replace("/onboarding"); return; }
        setProfile(family); setConversations(existing); setSavedCount(saved.length); setReady(true);
        // Money is optional on Home: a failure (e.g. not yet signed in) just leaves the setup card.
        loadMoney(monthKey(new Date())).then((bundle) => { if (cancelled) return; setMoney(summarizeMonth(bundle)); const today = localDay(new Date()); setLoggedToday(bundle.transactions.some((tx) => tx.occurredOn === today)); }).catch(() => {});
        loadPurchases().then((purchases) => { if (!cancelled) setStock(estimateStock(purchases, rateResolver(family))); }).catch(() => {});
      } catch (cause) { if (!cancelled) { setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu."); setReady(true); } }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  if (!ready) return <div className="app-page" aria-busy="true"><p className="app-sub">Đang chuẩn bị bản tin gia đình…</p></div>;
  const brief: FamilyBrief = buildBrief({ profile, conversations, savedCount, displayName: account.name, money, stock });
  const tracked = stock[0];
  const latest = conversations[0];
  const child = profile?.children[0];

  return <div className="app-page">
    <div><h1>{brief.greeting}</h1><p className="app-sub">{brief.subtitle}</p></div>
    {error && <p className="form-error">{error}</p>}

    <section className="app-section" aria-labelledby="brief-att"><h2 id="brief-att">Cần chú ý</h2>
      <div className="brief-att">{brief.attention.map((card) => <div className="app-card brief-card" key={card.id}><span className={`ic ${card.tone}`} aria-hidden="true">{card.badge}</span><div className="t"><b>{card.title}</b><small>{card.detail}</small></div><Link className={`app-btn${card.tone === "warn" ? "" : " ghost"}`} href={card.cta.href}>{card.cta.label}</Link></div>)}</div>
    </section>

    {profile && <DailyTasks profile={profile} loggedToday={loggedToday} />}

    <div className="app-grid2">
      <section className="app-section" aria-labelledby="brief-money"><h2 id="brief-money">Tiền tháng này</h2>
        <div className="app-card"><div className="app-grid2"><div className="brief-kpi"><small>Đã chi</small><b>{money?.expense ? shortVnd(money.expense) : "—"}</b></div><div className="brief-kpi"><small>Kế hoạch</small><b>{money?.plan ? shortVnd(money.plan) : "—"}</b></div></div>
          {money?.plan ? <span className="bar"><span style={{ width: `${Math.min(100, Math.round(money.expense / money.plan * 100))}%` }} className={money.expense > money.plan ? "over" : undefined} /></span> : null}
          <p className="app-sub" style={{ marginTop: 10 }}>{money && money.transactionCount ? <>{money.expectedExpense ? `Dự kiến cuối tháng chi ${shortVnd(money.expectedExpense)}` : `${money.transactionCount} khoản tháng này`}{money.plan && money.remainingOfPlan !== undefined ? ` · còn ${shortVnd(money.remainingOfPlan)} trong kế hoạch` : ""}. </> : "Chưa có giao dịch nào. "}<Link className="brief-link" href="/money">Mở Tiền →</Link></p></div>
      </section>
      <section className="app-section" aria-labelledby="brief-shop"><h2 id="brief-shop">Mua sắm</h2>
        <div className="app-card"><div className="brief-kv">
          <span>Đang tư vấn cho</span><em>{child ? `${child.name ? `bé ${child.name}` : "bé"}${child.weightKg ? ` · ${formatWeight(child.weightKg)}` : ""}${child.diaperSize ? ` · size ${child.diaperSize}` : ""}` : "Chưa có bé trong hồ sơ"}</em>
          <span>Đang theo dõi</span><em>{tracked ? `${tracked.productName} · ${tracked.daysLeft === 0 ? "ước tính đã hết" : `còn ~${tracked.daysLeft} ngày`}${stock.length > 1 ? ` (+${stock.length - 1})` : ""}` : "Chưa có — bấm “Đã mua” sau khi mua"}</em>
          <span>Đã lưu</span><em>{savedCount ? `${savedCount} sản phẩm` : "Chưa có"}</em>
          <span>Gần đây</span><em>{latest ? latest.title : "Chưa có cuộc trò chuyện"}</em>
        </div><p className="app-sub" style={{ marginTop: 10 }}><Link className="brief-link" href="/shopping">Mở Mua sắm →</Link></p></div>
      </section>
    </div>

    {brief.insights.length > 0 && <section className="app-section" aria-labelledby="brief-ins"><h2 id="brief-ins">FamAgent nhận thấy</h2>
      <div className="brief-att">{brief.insights.map((item, index) => <div className="app-card brief-insight" key={index}><span className="app-orb" aria-hidden="true" /><div><p>{item.text}</p><small>{item.source}{item.href && <> · <Link className="brief-link" href={item.href}>Hỏi thêm</Link></>}</small></div></div>)}</div>
    </section>}
  </div>;
}
