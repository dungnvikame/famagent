"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { parseVnd } from "@/lib/money/parse";
import { shortVnd, type MonthSummary } from "@/lib/money/summary";
import type { MoneyBudget, MoneyCategory } from "@/lib/money/types";

interface Props { summary: MonthSummary; categories: MoneyCategory[]; budgets: MoneyBudget[]; onBudget: (item: MoneyBudget) => Promise<void>; onDeleteBudget: (id: string) => Promise<void> }

/** Month view: where money went vs. budget per category (editable), upcoming recurring, rule-based insights. */
export function MonthView({ summary, categories, budgets, onBudget, onDeleteBudget }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const names = [...new Set([...summary.byCategory.map((line) => line.category), ...categories.filter((item) => item.kind === "expense" && !item.archived).map((item) => item.name)])];
  const lines = names.map((name) => summary.byCategory.find((line) => line.category === name) ?? { category: name, spent: 0, forChild: 0, limit: undefined, ratio: undefined });

  async function save(category: string) {
    const amount = parseVnd(value);
    const existing = budgets.find((item) => item.category === category);
    try {
      if (amount === null || amount <= 0) { if (existing && !value.trim()) await onDeleteBudget(existing.id); else { setError("Ngân sách không hợp lệ (ví dụ 5tr)."); return; } }
      else await onBudget({ id: existing?.id ?? crypto.randomUUID(), category, month: summary.month, limitAmount: amount });
      setEditing(null); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  return <div className="month-view">
    {summary.insights.length > 0 && <div className="brief-att">{summary.insights.map((item) => <div className="app-card brief-insight" key={item.id}><span className="app-orb" aria-hidden="true" /><div><p>{item.text}</p><small>{item.source}</small></div></div>)}</div>}
    <section className="app-section"><h2>Tiền đang đi đâu</h2>
      <div className="app-card app-rows budget-rows">
        {lines.map((line) => <div key={line.category}>
          <div className="budget-name"><b>{line.category}</b><small>{line.spent ? `Đã chi ${shortVnd(line.spent)}` : "Chưa chi"}{line.limit ? ` / ngân sách ${shortVnd(line.limit)}` : ""}{line.forChild ? ` · cho con ${shortVnd(line.forChild)}` : ""}</small>{line.limit ? <span className="bar"><span style={{ width: `${Math.min(100, Math.round((line.ratio ?? 0) * 100))}%` }} className={line.ratio && line.ratio > 1 ? "over" : undefined} /></span> : null}</div>
          {editing === line.category ? <span className="budget-edit"><input autoFocus inputMode="decimal" placeholder="5tr" aria-label={`Ngân sách ${line.category}`} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(line.category); if (event.key === "Escape") setEditing(null); }} /><button type="button" className="app-btn" onClick={() => void save(line.category)}>Lưu</button></span>
            : <button type="button" className={`app-pill${line.ratio && line.ratio > 1 ? " warn" : line.limit ? " ok" : ""} budget-pill`} onClick={() => { setEditing(line.category); setValue(line.limit ? String(line.limit) : ""); }}>{line.limit ? `${Math.round((line.ratio ?? 0) * 100)}%` : "Đặt ngân sách"}</button>}
        </div>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
    <div className="app-grid2">
      <section className="app-section"><h2>Sắp tới (7 ngày)</h2><div className="app-card app-rows">{summary.upcoming.length ? summary.upcoming.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.daysLeft === 0 ? "Hôm nay" : `Còn ${item.daysLeft} ngày`} · {item.dueOn.slice(8)}/{item.dueOn.slice(5, 7)}</small></span><b>{item.kind === "income" ? "+" : ""}{vnd(item.amount)}</b></div>) : <div><small>Không có khoản định kỳ nào đến hạn trong 7 ngày.</small></div>}</div></section>
      <section className="app-section"><h2>Số dư</h2><div className="app-card app-rows"><div><span><b>Tiền mặt / tài khoản</b><small>Đầu kỳ + thu − chi − tiết kiệm</small></span><b>{vnd(summary.balances.cash)}</b></div><div><span><b>Tiết kiệm</b><small>Đầu kỳ + các khoản chuyển tiết kiệm</small></span><b>{vnd(summary.balances.savings)}</b></div></div></section>
    </div>
  </div>;
}
