"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app-shell/use-account";
import { DATA_CHANGED } from "@/components/inbox/inbox";
import { StockCheck } from "@/components/shopping/stock-check";
import { buildAttention, FEEDBACK_LABELS, FEEDBACK_VERDICTS, type Attention, type FeedbackVerdict, type Insight, type InsightFeedback } from "@/lib/attention/engine";
import { loadFeedback, sendFeedback } from "@/lib/attention/feedback-client";
import { loadSnapshot, type LoadedState } from "@/lib/attention/snapshot-client";
import { familyPolicy } from "@/lib/policy/family-policy";

/**
 * Home = Attention Feed (core journey spec §3): no dashboard — "nhà mình đang có gì đáng chú ý?". At most three cards,
 * each with its source, one action and feedback that changes what FamAgent shows; then what is going fine.
 */
export function FamilyBriefPage() {
  const router = useRouter();
  const account = useAccount();
  const [state, setState] = useState<LoadedState | null>(null);
  const [feedback, setFeedback] = useState<InsightFeedback[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [loaded, answers] = await Promise.all([loadSnapshot(account.name), loadFeedback().catch(() => [])]);
      if (!loaded.snapshot.profile?.onboardedAt) { router.replace("/onboarding"); return; }
      setState(loaded); setFeedback(answers); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu."); }
  }, [account.name, router]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const refresh = () => void load(); window.addEventListener(DATA_CHANGED, refresh); return () => window.removeEventListener(DATA_CHANGED, refresh); }, [load]);

  if (!state) return <div className="app-page" aria-busy="true"><p className="app-sub">{error || "Đang xem nhà mình có gì đáng chú ý…"}</p></div>;
  const policy = familyPolicy(state.snapshot.profile);
  const home: Attention = buildAttention(state.snapshot, policy, feedback);

  async function answer(insight: Insight, verdict: FeedbackVerdict) {
    try { const entry = await sendFeedback(insight.key, verdict); setFeedback((current) => [...current.filter((item) => item.key !== entry.key), entry]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được phản hồi."); }
  }

  return <div className="app-page home-feed">
    <div><h1>{home.greeting}</h1><p className="app-sub">{home.subtitle}</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}

    {home.attention.length > 0 && <section className="app-section" aria-labelledby="home-att"><h2 id="home-att">Cần chú ý</h2>
      <div className="brief-att">{home.attention.map((insight) => <InsightCard key={insight.key} insight={insight} state={state} onAnswer={(verdict) => void answer(insight, verdict)} onChanged={() => void load()} />)}</div>
    </section>}

    {home.starters.length > 0 && <section className="app-section" aria-labelledby="home-start"><h2 id="home-start">Bắt đầu</h2>
      <div className="brief-att">{home.starters.map((step) => <div className="app-card brief-card" key={step.id}><span className="ic info" aria-hidden="true">＋</span><div className="t"><b>{step.title}</b><small>{step.detail}</small></div><Link className="app-btn ghost" href={step.href}>{step.cta}</Link></div>)}</div>
    </section>}

    {home.fine.length > 0 && <section className="app-section" aria-labelledby="home-fine"><h2 id="home-fine">Đang ổn</h2>
      <ul className="app-card home-fine">{home.fine.map((line) => <li key={line}>{line}</li>)}</ul>
    </section>}

    <p className="app-sub money-foot"><Link className="brief-link" href="/home/week">Xem bản tin tuần của nhà mình →</Link></p>
  </div>;
}

/** One attention card: title, detail, source, one CTA and "⋯" feedback. "Không đúng" on stock asks "còn không?". */
function InsightCard({ insight, state, onAnswer, onChanged }: { insight: Insight; state: LoadedState; onAnswer: (verdict: FeedbackVerdict) => void; onChanged: () => void }) {
  const [menu, setMenu] = useState(false);
  // Keyboard: Escape closes the feedback menu; arrows move between its items.
  function onMenuKey(event: React.KeyboardEvent<HTMLSpanElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { setMenu(false); (event.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
    if (event.key === "ArrowDown") { event.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
  }
  const [checking, setChecking] = useState(false);
  const estimate = insight.kind === "stock_low" ? state.snapshot.estimates.find((entry) => entry.item.id === insight.subjectId) : undefined;
  function pick(verdict: FeedbackVerdict) {
    setMenu(false);
    // Feedback must change the state, not only a log: a wrong stock estimate is corrected right here.
    if (verdict === "wrong" && estimate) { setChecking(true); return; }
    onAnswer(verdict);
  }
  return <div className="app-card brief-card insight-card">
    <span className={`ic ${insight.tone}`} aria-hidden="true">{insight.badge}</span>
    <div className="t"><b>{insight.title}</b><small>{insight.detail}</small><small className="insight-source">{insight.source}</small>
      {checking && estimate && <StockCheck estimate={estimate} onDone={() => { setChecking(false); onAnswer("wrong"); onChanged(); }} />}
    </div>
    <span className="insight-actions">
      <Link className={`app-btn${insight.tone === "warn" ? "" : " ghost"}`} href={insight.cta.href}>{insight.cta.label}</Link>
      <span className="insight-more">
        <button type="button" className="ledger-link" aria-haspopup="menu" aria-expanded={menu} aria-label={`Phản hồi về: ${insight.title}`} onClick={() => setMenu((open) => !open)}>⋯</button>
        {menu && <span className="insight-menu" role="menu" onKeyDown={onMenuKey} ref={(node) => { node?.querySelector("button")?.focus(); }}>{FEEDBACK_VERDICTS.map((verdict) => <button key={verdict} type="button" role="menuitem" onClick={() => pick(verdict)}>{FEEDBACK_LABELS[verdict]}</button>)}</span>}
      </span>
    </span>
  </div>;
}
