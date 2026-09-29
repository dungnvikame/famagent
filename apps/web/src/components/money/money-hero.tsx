"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
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
 * The one number the month is about — how much of the plan is still free — with the two pots beside it.
 * Debts, lending and the total sit behind "Xem thêm số dư", so the first screen stays readable.
 */
export function MoneyHero({ summary, pots, debts, current, today, onPlan }: HeroProps) {
  const [more, setMore] = useState(false);
  const hasPlan = summary.plan !== undefined;
  const value = hasPlan ? summary.remainingOfPlan ?? 0 : summary.net;
  const over = hasPlan && value < 0;
  const flows = summary.loanFlows;
  const inclusive = [flows.repaid > 0 && `trả nợ ${vndCompact(flows.repaid)}`, flows.lent > 0 && `cho vay ${vndCompact(flows.lent)}`].filter(Boolean).join(" · ");
  const percent = hasPlan ? Math.min(100, Math.round(summary.expense / summary.plan! * 100)) : 0;
  const marker = current ? Math.min(100, Math.round(today.day / today.days * 1000) / 10) : undefined;
  const pace = current ? paceOf(summary) : null;
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
          <p className="mh-sub">Đã chi {vndCompact(summary.expense)} / kế hoạch {vndCompact(summary.plan!)}{inclusive && <> · trong đó {inclusive}</>}</p>
          <div className="mh-bar" role="img" aria-label={`Đã chi ${percent}% kế hoạch${marker !== undefined ? `, hôm nay là ngày ${today.day} trên ${today.days}` : ""}`}>
            <i className={over ? "over" : undefined} style={{ width: `${percent}%` }} />{marker !== undefined && <u style={{ left: `${marker}%` }} title="Hôm nay" />}
          </div>
          {marker !== undefined && <div className="mh-legend"><span>Ngày 1</span><span>Hôm nay {today.day}/{Number(summary.month.slice(5))}</span><span>{today.days}</span></div>}
          {(pace || (current && summary.expectedExpense !== undefined)) && <div className="mh-pills">
            {pace && <span className={`mh-pill ${pace.tone}`}>{pace.text}</span>}
            {summary.expectedExpense !== undefined && <span className="mh-pill note">Dự kiến cuối tháng {vndCompact(summary.expectedExpense)}</span>}
          </div>}
        </>
        : <p className="mh-sub">Chưa đặt kế hoạch chi tháng. <button type="button" className="mh-link" onClick={onPlan}>Đặt kế hoạch</button> để FamAgent cho bạn biết còn tiêu được bao nhiêu.</p>}
    </div>
    <div className="mh-pots">
      <div className="mh-pot"><span>Tiền tiêu</span><b className={pots.cash < 0 ? "neg" : undefined}>{vnd(pots.cash)}</b></div>
      <div className="mh-pot"><span>Quỹ tiết kiệm</span><b>{vnd(pots.savings)}</b></div>
      <button type="button" className="mh-link" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Ẩn bớt ▴" : "Xem thêm số dư ▾"}</button>
      {more && <ul className="mh-extra">{extras.map((item) => <li key={item.label} className={item.tone}><span>{item.label}</span><b>{item.value}</b></li>)}</ul>}
    </div>
  </section>;
}

/** Recurring items due in the next days (from the ledger's monthly items); marking them paid comes with the new fixed-item flow. */
export function DueStrip({ items }: { items: MonthSummary["upcoming"] }) {
  if (!items.length) return null;
  return <section className="mh-due" aria-label="Sắp đến hạn">
    <h2>Sắp đến hạn</h2>
    <ul>{items.slice(0, 3).map((item) => <li key={item.id} className={item.daysLeft <= 2 ? "soon" : undefined}>
      <b>{item.name}</b>
      <span>{vndCompact(item.amount)} · {item.kind === "income" ? "sẽ nhận" : "sẽ chi"} {item.daysLeft === 0 ? "hôm nay" : `sau ${item.daysLeft} ngày`}</span>
    </li>)}</ul>
  </section>;
}
