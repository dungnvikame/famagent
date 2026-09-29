"use client";

import { vnd } from "@/lib/catalog/format";
import { vndCompact } from "@/lib/money/format-vnd";
import { hasOutlook, outlook, type Tip } from "@/lib/money/outlook";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBundle } from "@/lib/money/types";

interface Props {
  bundle: MoneyBundle;
  summary: MonthSummary;
  now: Date;
  onOpenLedger: (category?: string) => void;
  onTab: (tab: "plan" | "debt") => void;
}

const ICON: Record<Tip["tone"], string> = { warn: "!", ok: "✓", info: "i" };
const minus = (amount: number) => (amount > 0 ? `−${vndCompact(amount)}` : "—");

/** "Tương lai & nên làm gì": the next 3 months from the fixed items and the plan, and up to 3 suggestions that only navigate. */
export function FutureCard({ bundle, summary, now, onOpenLedger, onTab }: Props) {
  if (!hasOutlook(bundle, now)) {
    return <section className="app-card future" aria-labelledby="future-title">
      <h3 id="future-title">Tương lai &amp; nên làm gì</h3>
      <p className="future-empty">Thêm khoản thu và chi cố định ở tab Kế hoạch để xem 3 tháng tới.</p>
      <button type="button" className="app-btn ghost future-act" onClick={() => onTab("plan")}>Mở tab Kế hoạch</button>
    </section>;
  }
  const { months, tips } = outlook(bundle, summary, now);
  const go = (tip: Tip) => {
    if (!tip.action) return;
    if (tip.action.target === "ledger") onOpenLedger(tip.action.category);
    else onTab(tip.action.target);
  };

  return <section className="app-card future" aria-labelledby="future-title">
    <div className="card-head"><h3 id="future-title">Tương lai &amp; nên làm gì</h3><small className="future-sub">{months.length} tháng tới</small></div>
    <p className="future-hint">Tính từ khoản cố định và kế hoạch tháng; khoản quý/năm trừ vào tháng nó đến hạn.</p>
    <div className="future-scroll" role="region" aria-label="Dòng tiền 3 tháng tới" tabIndex={0}>
      <table className="future-table">
        <thead><tr><th scope="col"><span className="sr-only">Khoản</span></th>{months.map((row) => <th scope="col" key={row.month}>T{Number(row.month.slice(5))}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Thu dự kiến</th>{months.map((row) => <td key={row.month}>{row.income > 0 ? vndCompact(row.income) : "—"}</td>)}</tr>
          <tr><th scope="row">Cố định hằng tháng</th>{months.map((row) => <td key={row.month}>{minus(row.fixed)}</td>)}</tr>
          <tr><th scope="row">Khoản quý/năm</th>{months.map((row) => <td key={row.month} title={row.lumps.map((lump) => `${lump.name} ${vnd(lump.amount)}`).join(", ") || undefined}>{row.lumps.length ? row.lumps.map((lump) => <span key={lump.name} className="lump">{lump.name} −{vndCompact(lump.amount)}</span>) : "—"}</td>)}</tr>
          <tr><th scope="row">Chi linh hoạt · tiết kiệm</th>{months.map((row) => <td key={row.month}>{minus(row.flexible)} · {minus(row.saving)}</td>)}</tr>
          <tr className="left"><th scope="row">Còn lại</th>{months.map((row) => <td key={row.month} className={row.left < 0 ? "neg" : "pos"} title={vnd(row.left)}>{row.left < 0 ? "−" : "+"}{vndCompact(row.left)}</td>)}</tr>
        </tbody>
      </table>
    </div>

    <h4 className="future-todo-title">Nên làm</h4>
    {tips.length ? <ul className="future-tips">{tips.map((tip) => <li key={tip.id} className={`future-tip ${tip.tone}`}>
      <span className="ic" aria-hidden="true">{ICON[tip.tone]}</span>
      <span className="txt"><b>{tip.title}</b><small>{tip.detail}</small></span>
      {tip.action && <button type="button" className="app-btn ghost future-act" onClick={() => go(tip)}>{tip.action.label}</button>}
    </li>)}</ul> : <p className="future-empty">Chưa có gợi ý nào lúc này.</p>}
  </section>;
}
