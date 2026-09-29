"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import type { DueEntry } from "@/lib/money/fixed-items";
import { vndCompact } from "@/lib/money/format-vnd";
import type { PotBalance } from "@/lib/money/history";
import type { MonthSummary } from "@/lib/money/summary";

interface HeroProps {
  summary: MonthSummary;
  pots: PotBalance;
  /** What we owe (ledger loans + Tình hình debts) and what others owe us. */
  debts?: { owed: number; lent: number };
  /** The month shown is the running one (today marker, pace pills). */
  current: boolean;
  /** 1-based day of the month today, and days in the month (for the bar marker). */
  today: { day: number; days: number };
  onPlan: () => void;
}

/** Trạng thái nhịp chi so với kế hoạch, from the forecast the summary already computed. */
function paceOf(summary: MonthSummary): { tone: "ok" | "warn"; text: string } | null {
  if (!summary.plan || summary.paceRatio === undefined || summary.expectedExpense === undefined) return null;
  if (summary.paceRatio > 1.05) return { tone: "warn", text: `Có thể vượt kế hoạch ~${Math.round((summary.paceRatio - 1) * 100)}%` };
  if (summary.paceRatio <= 0.9) return { tone: "ok", text: "Đang chi chậm hơn kế hoạch" };
  return { tone: "ok", text: "Đúng nhịp" };
}

/**
 * The one number the month is about — how much can still be spent freely — with the two pots beside it. In the running
 * month it is plan − spent − fixed expenses nobody has confirmed yet, so rent or an instalment due next week is already
 * held back. Debts, lending and the total sit behind "Xem thêm số dư", so the first screen stays readable.
 */
export function MoneyHero({ summary, pots, debts, current, today, onPlan }: HeroProps) {
  const [more, setMore] = useState(false);
  const hasPlan = summary.plan !== undefined;
  const heldBack = current ? summary.fixedDue : 0;
  const value = hasPlan ? (current ? summary.freeToSpend : undefined) ?? summary.remainingOfPlan ?? 0 : summary.net;
  const over = hasPlan && value < 0;
  const flows = summary.loanFlows;
  const inclusive = [flows.repaid > 0 && `trả nợ ${vndCompact(flows.repaid)}`, flows.lent > 0 && `cho vay ${vndCompact(flows.lent)}`].filter(Boolean).join(" · ");
  const share = (amount: number) => hasPlan && summary.plan! > 0 ? Math.min(100, Math.round(amount / summary.plan! * 100)) : 0;
  const spentPct = share(summary.expense);
  const heldPct = Math.min(100 - spentPct, share(heldBack));
  const marker = current ? Math.min(100, Math.round(today.day / today.days * 1000) / 10) : undefined;
  const pace = current ? paceOf(summary) : null;
  const waiting = summary.due.filter((entry) => entry.kind === "expense" && entry.period === summary.month).length;
  const extras: Array<{ label: string; value: string; tone?: "warn" | "ok" }> = [{ label: "Tổng đang có", value: vnd(pots.account) }];
  if (pots.lem > 0) extras.push({ label: "Tiêu lẹm (đang dùng quá tiền tiêu)", value: vnd(pots.lem), tone: "warn" });
  if (debts && debts.owed > 0) extras.push({ label: "Mình đang nợ", value: vnd(debts.owed), tone: "warn" });
  if (debts && debts.lent > 0) extras.push({ label: "Người khác nợ mình", value: vnd(debts.lent), tone: "ok" });

  return <section className="app-card mh" aria-label={hasPlan ? "Còn tiêu được tháng này" : "Còn lại trong tháng"}>
    <div className="mh-main">
      <div className="mh-eyebrow">{hasPlan ? over ? "Đã vượt kế hoạch" : current ? "Còn tiêu được tháng này" : "Còn lại trong kế hoạch" : "Còn lại (thu − chi − tiết kiệm)"}</div>
      <div className={`mh-big${over || (!hasPlan && value < 0) ? " neg" : ""}`}>{summary.income || summary.expense || hasPlan ? `${value < 0 ? "−" : ""}${vnd(Math.abs(value))}` : "—"}</div>
      {hasPlan
        ? <>
          <p className="mh-sub">Đã chi {vndCompact(summary.expense)} / kế hoạch {vndCompact(summary.plan!)}{inclusive && <> · trong đó {inclusive}</>}
            {heldBack > 0 && <><br />Đã trừ {vndCompact(heldBack)} cho {waiting || "các"} khoản cố định chưa trả</>}</p>
          <div className="mh-bar" role="img" aria-label={`Đã chi ${spentPct}% kế hoạch${heldBack > 0 ? `, khoản cố định chưa trả ${heldPct}%` : ""}${marker !== undefined ? `, hôm nay là ngày ${today.day} trên ${today.days}` : ""}`}>
            <i className={over ? "over" : undefined} style={{ width: `${spentPct}%` }} />
            {heldBack > 0 && <i className="held" style={{ left: `${spentPct}%`, width: `${heldPct}%` }} />}
            {marker !== undefined && <u style={{ left: `${marker}%` }} title="Hôm nay" />}
          </div>
          {marker !== undefined && <div className="mh-legend"><span>Ngày 1</span><span>Hôm nay {today.day}/{Number(summary.month.slice(5))}</span><span>{today.days}</span></div>}
          {heldBack > 0 && <div className="mh-key"><span><i className="k-spent" />Đã chi</span><span><i className="k-held" />Cố định chưa trả</span><span><i className="k-free" />Còn tự do</span></div>}
          {(pace || (current && summary.expectedExpense !== undefined)) && <div className="mh-pills">
            {pace && <span className={`mh-pill ${pace.tone}`}>{pace.text}</span>}
            {summary.expectedExpense !== undefined && <span className="mh-pill note">Dự kiến cuối tháng {vndCompact(summary.expectedExpense)}</span>}
          </div>}
        </>
        : <p className="mh-sub">Chưa có kế hoạch chi tháng. <button type="button" className="mh-link" onClick={onPlan}>Lập kế hoạch</button> để FamAgent cho bạn biết còn tiêu được bao nhiêu.</p>}
    </div>
    <div className="mh-pots">
      <div className="mh-pot"><span>Tiền tiêu</span><b className={pots.cash < 0 ? "neg" : undefined}>{vnd(pots.cash)}</b></div>
      <div className="mh-pot"><span>Quỹ tiết kiệm</span><b>{vnd(pots.savings)}</b></div>
      <button type="button" className="mh-link" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Ẩn bớt ▴" : "Xem thêm số dư ▾"}</button>
      {more && <ul className="mh-extra">{extras.map((item) => <li key={item.label} className={item.tone}><span>{item.label}</span><b>{item.value}</b></li>)}</ul>}
    </div>
  </section>;
}

const STATE_LABEL: Record<DueEntry["state"], string> = { overdue: "Quá hạn", due: "Tới hạn", soon: "Sắp tới" };

/** Fixed-item periods waiting for an answer: one card each, with the button that opens the "Đã trả?" dialog. */
export function DueStrip({ items, onPay }: { items: DueEntry[]; onPay: (entry: DueEntry) => void }) {
  if (!items.length) return null;
  return <section className="due-strip" aria-label="Đến hạn">
    <h2>Đến hạn <em>{items.length} khoản</em></h2>
    <ul>{items.map((entry) => <li key={`${entry.recurringId}:${entry.period}`} className={entry.state}>
      <div><b>{entry.name}</b><span>{entry.estimated ? "~" : ""}{vndCompact(entry.amount)} · {entry.label}</span><em className={`due-tag ${entry.state}`}>{STATE_LABEL[entry.state]}</em></div>
      <button type="button" className={entry.state === "soon" ? "alt" : undefined} onClick={() => onPay(entry)}>{entry.kind === "income" ? "Đã nhận?" : "Đã trả?"}</button>
    </li>)}</ul>
  </section>;
}
