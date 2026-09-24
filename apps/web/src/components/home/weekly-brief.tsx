"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/app-shell/use-account";
import { sendFeedback } from "@/lib/attention/feedback-client";
import { loadSnapshot, type LoadedState } from "@/lib/attention/snapshot-client";
import { buildWeekly } from "@/lib/attention/weekly";

/** Weekly Family Brief (core journey spec §8): Tiền · Mua sắm · Mục tiêu · Tuần tới, one line each, one CTA. */
export function WeeklyBriefPage() {
  const account = useAccount();
  const [state, setState] = useState<LoadedState | null>(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  useEffect(() => { loadSnapshot(account.name).then(setState).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.")); }, [account.name]);
  if (!state) return <div className="app-page" aria-busy="true"><p className="app-sub">{error || "Đang tổng hợp tuần này…"}</p></div>;
  const brief = buildWeekly(state.snapshot, state.shopping.purchases);
  const block = (title: string, lines: string[]) => lines.length ? <section className="app-section" aria-label={title}><h2>{title}</h2><ul className="app-card home-fine">{lines.map((line) => <li key={line}>{line}</li>)}</ul></section> : null;
  return <div className="app-page home-feed">
    <div><h1>Nhà mình tuần này</h1><p className="app-sub">7 ngày gần nhất · từ sổ Tiền và các lần mua đã ghi</p></div>
    {block("Tiền", brief.money)}
    {block("Mua sắm", brief.shopping)}
    {block("Mục tiêu", brief.goal)}
    {block("Tuần tới", brief.nextWeek)}
    <span className="purchase-actions"><Link className="app-btn" href="/shopping#plan-title">Chuẩn bị tuần tới</Link><Link className="ledger-link" href="/home">← Trang chủ</Link>
      {!muted && <button type="button" className="ledger-link" onClick={() => void sendFeedback("weekly_brief:all", "mute").then(() => setMuted(true))}>Đừng gửi bản tin tuần qua thông báo</button>}
    </span>
    {muted && <p className="app-sub" role="status">Đã tắt thông báo bản tin tuần. Trang này vẫn xem được bất cứ lúc nào.</p>}
  </div>;
}
