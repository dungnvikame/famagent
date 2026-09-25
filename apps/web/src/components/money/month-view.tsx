"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { categoryRows, cumulativeSpend, dailyCash, monthInsights, pulseOf, topExpenses, versusLastMonth, type CategoryRow, type MonthInsight } from "@/lib/money/month-report";
import { formatVnDate, parseVnd } from "@/lib/money/parse";
import { daysInMonth, monthKey, type MonthSummary } from "@/lib/money/summary";
import type { MoneyBudget, MoneyBundle } from "@/lib/money/types";
import { AmountInput } from "./amount-input";
import { CashChart, PaceChart, TrendChart } from "./money-charts";

interface Props {
  summary: MonthSummary;
  bundle: MoneyBundle;
  /** Cash at the start of the month (for the daily balance chart). */
  openingCash: number;
  onBudget: (item: MoneyBudget) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  /** Open the Sổ tab filtered on one category. */
  onOpenLedger: (category?: string) => void;
  onTab: (tab: "situ" | "plan") => void;
}

const SPANS = [3, 6, 12] as const;

/** Tháng: is the month on track, what needs attention, where the money went, and the trend. Short labels, exact numbers on hover. */
export function MonthView({ summary, bundle, openingCash, onBudget, onDeleteBudget, onOpenLedger, onTab }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [showIdle, setShowIdle] = useState(false);
  const [span, setSpan] = useState<(typeof SPANS)[number]>(6);
  const now = new Date();
  const month = summary.month;
  const current = monthKey(now) === month;
  const days = daysInMonth(month);
  const lastDay = current ? now.getDate() : days;
  const pulse = pulseOf(summary, now);
  const rows = categoryRows(bundle.transactions, bundle.budgets, bundle.history, month);
  // Spent beyond cash this month (taken from the savings fund): end-of-month shortfall minus the one it started with.
  const lemAdded = Math.max(0, -summary.balances.cash) - Math.max(0, -openingCash);
  const insights = monthInsights(summary, rows, now, lemAdded);
  const versus = versusLastMonth(bundle.history, month);
  const idle = bundle.settings.categories.filter((item) => item.kind === "expense" && !item.archived && !rows.some((row) => row.name === item.name)).map((item) => item.name);
  const scale = Math.max(1, ...rows.map((row) => Math.max(row.spent, row.budget ?? 0, row.average ?? 0))) * 1.05;
  const trend = (bundle.history ?? []).slice(-span);

  async function saveBudget(category: string) {
    const amount = value.trim() ? parseVnd(value) : null;
    const existing = bundle.budgets.find((item) => item.category === category);
    try {
      if (!value.trim()) { if (existing) await onDeleteBudget(existing.id); }
      else if (amount === null || amount <= 0) { setError("Ngân sách không hợp lệ (ví dụ 5tr)."); return; }
      else await onBudget({ id: existing?.id ?? crypto.randomUUID(), category, month, limitAmount: amount });
      setEditing(null); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  const act = (insight: MonthInsight) => {
    if (!insight.action) return;
    if (insight.action.kind === "ledger") onOpenLedger(insight.action.category);
    else if (insight.action.kind === "situ") onTab("situ");
    else if (insight.action.kind === "budget" && insight.action.category) { setEditing(insight.action.category); setValue(""); }
  };

  const budgetCell = (row: Pick<CategoryRow, "name" | "spent" | "budget">) => editing === row.name
    ? <span className="bud-edit" onClick={(event) => event.stopPropagation()}><AmountInput autoFocus placeholder="Ngân sách" aria-label={`Ngân sách ${row.name}`} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveBudget(row.name); if (event.key === "Escape") setEditing(null); }} /><button type="button" className="app-btn" onClick={() => void saveBudget(row.name)}>Lưu</button></span>
    : <button type="button" className={`bud ${row.budget ? (row.spent > row.budget ? "warn" : "ok") : "none"}`} title="Sửa ngân sách" onClick={(event) => { event.stopPropagation(); setEditing(row.name); setValue(row.budget ? row.budget.toLocaleString("vi-VN") : ""); }}>{row.budget ? `${Math.round(row.spent / row.budget * 100)}%` : "+ Ngân sách"}</button>;

  return <div className="month-view viz">
    <section className="app-card pulse">
      <div className="pulse-top">
        <div><small>Tháng {Number(month.slice(5))}{current && pulse.daysLeft !== undefined ? ` · còn ${pulse.daysLeft} ngày` : ""}</small><b className="big">{vnd(pulse.spent)}</b>{pulse.plan ? <span className="muted"> / {vnd(pulse.plan)}</span> : null}</div>
        {pulse.status === "over" && current && pulse.expected && pulse.plan ? <span className="status warn">Dự kiến vượt {vnd(pulse.expected - pulse.plan)}</span>
          : pulse.status === "over" ? <span className="status warn">Vượt {vnd(pulse.spent - pulse.plan!)}</span>
          : pulse.status === "ok" ? <span className="status ok">Đúng nhịp</span>
          : pulse.status === "done" ? <span className="status ok">Trong kế hoạch</span>
          : <button type="button" className="status none" onClick={() => onTab("plan")}>Đặt kế hoạch chi</button>}
      </div>
      {pulse.plan ? <div className="pbar" title={pulse.planToDate ? `Theo kế hoạch tới hôm nay: ${vnd(pulse.planToDate)}` : undefined}>
        <span className={`fill${pulse.progress! > 1 ? " over" : ""}`} style={{ width: `${Math.min(100, pulse.progress! * 100)}%` }} />
        {pulse.todayAt !== undefined && <span className="today" style={{ left: `${pulse.todayAt * 100}%` }} />}
      </div> : null}
      <div className="pulse-foot">
        <span>{pulse.planToDate ? <>Kế hoạch tới hôm nay <b>{vnd(pulse.planToDate)}</b></> : pulse.expected ? <>Dự kiến cuối tháng <b>{vnd(pulse.expected)}</b></> : null}</span>
        <span>Thu <b>{vnd(summary.income)}</b> · Để dành <b>{vnd(summary.saving)}</b>{summary.income > 0 && summary.saving > 0 ? ` (${Math.round(summary.saving / summary.income * 100)}%)` : ""}</span>
      </div>
    </section>

    {insights.length > 0 && <div className="insights">{insights.map((insight) => <div key={insight.key} className={`insight ${insight.tone}`}>
      <span className="ic" aria-hidden="true">{insight.tone === "warn" ? "!" : insight.tone === "ok" ? "✓" : "i"}</span>
      <span>{insight.text}</span>
      {insight.action && <button type="button" className="ledger-link acts" onClick={() => act(insight)}>{insight.action.label}</button>}
    </div>)}</div>}

    <div className="month-grid">
      <section className="app-card cat-card">
        <div className="card-head"><h3>Tiền đi đâu</h3><span className="legend"><span><i className="m-key-expense" />Đã chi</span><span><i className="m-key-budget" />Ngân sách</span><span><i className="m-key-avg" />TB 3 tháng</span></span></div>
        {rows.length ? <div className="cat-list">{rows.map((row) => <div key={row.name} className="cat-row" role="button" tabIndex={0} title={`Xem các khoản ${row.name}`} onClick={() => onOpenLedger(row.name)} onKeyDown={(event) => { if (event.key === "Enter") onOpenLedger(row.name); }}>
          <span className="nm"><b>{row.name}</b><small>{row.count} khoản</small></span>
          <span className="track" aria-hidden="true">
            {row.budget ? <span className="bg" style={{ width: `${row.budget / scale * 100}%` }} /> : null}
            <span className={`sp${row.budget && row.spent > row.budget ? " over" : ""}`} style={{ width: `${row.spent / scale * 100}%` }} />
            {row.average ? <span className="avg" style={{ left: `${row.average / scale * 100}%` }} /> : null}
          </span>
          <span className="amt">{vnd(row.spent)}{row.budget ? <small>/ {vnd(row.budget)}</small> : null}</span>
          <span className={`chg ${row.change === undefined ? "flat" : row.change > 5 ? "up" : row.change < -5 ? "down" : "flat"}`} title={row.average ? `TB 3 tháng ${vnd(row.average)}` : undefined}>{row.change === undefined ? "" : `${row.change > 0 ? "+" : ""}${row.change}%`}</span>
          {budgetCell(row)}
        </div>)}</div> : <p className="app-sub">Chưa có khoản chi nào tháng này.</p>}
        {idle.length > 0 && (showIdle ? <div className="cat-list idle">{idle.map((name) => <div key={name} className="cat-row idle-row"><span className="nm"><b>{name}</b></span><span /><span /><span />{budgetCell({ name, spent: 0 })}</div>)}</div>
          : <button type="button" className="cat-more" onClick={() => setShowIdle(true)}>+ {idle.length} nhóm chưa chi · đặt ngân sách</button>)}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <div className="side">
        {versus && <section className="app-card side-card"><h3>So với tháng trước</h3>
          {versus.map((delta) => { const good = delta.diff === undefined || delta.diff === 0 ? undefined : (delta.diff > 0) === delta.goodWhenUp; return <div key={delta.label} className="cmp"><span>{delta.label}</span><b>{vnd(delta.value)}</b><em className={good === undefined ? "" : good ? "good" : "bad"}>{delta.diff ? `${delta.diff > 0 ? "+" : "−"}${vnd(Math.abs(delta.diff))}` : "="}</em></div>; })}
        </section>}
        {current && summary.upcoming.length > 0 && <section className="app-card side-card"><h3>Sắp đến hạn</h3>
          {summary.upcoming.map((item) => <div key={item.id} className="up-row"><span><b>{item.name}</b><small>{item.daysLeft === 0 ? "Hôm nay" : `Còn ${item.daysLeft} ngày`} · {formatVnDate(item.dueOn)}</small></span><b className={item.kind === "income" ? "inc" : undefined}>{item.kind === "income" ? "+" : ""}{vnd(item.amount)}</b></div>)}
        </section>}
        {topExpenses(bundle.transactions, month).length > 0 && <section className="app-card side-card"><h3>Khoản lớn nhất</h3>
          {topExpenses(bundle.transactions, month).map((tx) => <div key={tx.id} className="up-row"><span><b>{tx.content}</b><small>{formatVnDate(tx.occurredOn)} · {tx.category}</small></span><b>{vnd(tx.amount)}</b></div>)}
        </section>}
      </div>
    </div>

    <div className="chart-grid">
      {trend.some((row) => row.income || row.expense) && <section className="app-card chart-card wide">
        <div className="card-head"><h3>Thu và chi</h3><span className="seg" role="group" aria-label="Khoảng thời gian">{SPANS.map((item) => <button type="button" key={item} className={span === item ? "on" : undefined} onClick={() => setSpan(item)}>{item} tháng</button>)}</span></div>
        <span className="legend"><span><i className="m-key-income" />Thu</span><span><i className="m-key-expense" />Chi</span></span>
        <TrendChart rows={trend} />
      </section>}
      <section className="app-card chart-card">
        <div className="card-head"><h3>Nhịp chi</h3><span className="legend"><span><i className="m-key-line-expense" />Thực tế</span>{summary.plan ? <span><i className="m-key-line-plan" />Kế hoạch</span> : null}</span></div>
        <PaceChart cumulative={cumulativeSpend(bundle.transactions, month, lastDay)} plan={summary.plan} days={days} month={month} />
      </section>
      <section className="app-card chart-card">
        <div className="card-head"><h3>Số dư theo ngày</h3></div>
        <CashChart series={dailyCash(bundle.transactions, month, openingCash, lastDay)} month={month} />
      </section>
    </div>
  </div>;
}
