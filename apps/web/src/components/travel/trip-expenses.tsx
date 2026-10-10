"use client";

// Tab Chi phí: budget per bucket vs actual, quick expense entry and the list. Every expense also lands in the
// money ledger server-side (source "trip", category "Du lịch") — one source of truth, never counted twice.
import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { vndCompact } from "@/lib/money/format-vnd";
import { formatVnDate, groupAmountTyping, parseVnd, todayLocal } from "@/lib/money/parse";
import { bucketBudgets, plannedTotal, spentByBucket, spentTotal } from "@/lib/travel/trip-state";
import { BUCKET_LABELS, DEFAULT_BUDGET_SPLIT, EXPENSE_BUCKETS, type ExpenseBucket, type ItineraryEntry, type Trip, type TripExpense } from "@/lib/travel/types";

export function TripExpenses({ trip, expenses, itinerary, onSave, onDelete, onTrip }: {
  trip: Trip; expenses: TripExpense[]; itinerary: ItineraryEntry[];
  onSave: (expense: TripExpense) => void; onDelete: (id: string) => void; onTrip: (trip: Trip) => void;
}) {
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<ExpenseBucket>("food");
  const [formError, setFormError] = useState("");
  const [editingSplit, setEditingSplit] = useState(false);

  const budgets = bucketBudgets(trip);
  const spent = spentByBucket(expenses);
  const total = spentTotal(expenses);
  const planned = plannedTotal(itinerary);
  const split = { ...DEFAULT_BUDGET_SPLIT, ...trip.budgetSplit };
  const over = trip.budgetAmount > 0 && total > trip.budgetAmount;
  const near = trip.budgetAmount > 0 && !over && total > trip.budgetAmount * 0.85;
  const sorted = [...expenses].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  function add() {
    const value = parseVnd(amount);
    if (!content.trim() || value === null || value <= 0) { setFormError("Nhập nội dung và số tiền (vd 850k, 1,2tr)"); return; }
    setFormError("");
    onSave({ id: crypto.randomUUID(), tripId: trip.id, occurredOn: todayLocal(), content: content.trim().slice(0, 120), bucket, amount: value });
    setContent(""); setAmount("");
  }

  return <section className="tv-card tv-panel">
    <div className="tv-bud-top">
      <div>
        <span className="tv-eyebrow">Đã chi{trip.budgetAmount > 0 ? " / ngân sách" : ""}</span>
        <div className="tv-big">{vndCompact(total)}{trip.budgetAmount > 0 && <small> / {vndCompact(trip.budgetAmount)}</small>}</div>
      </div>
      {trip.budgetAmount > 0 && <span className={`tv-pill ${over ? "tv-pill-danger" : near ? "tv-pill-warn" : "tv-pill-ok"}`}>{over ? "Vượt ngân sách" : near ? "Gần chạm ngân sách" : "Trong kế hoạch"}</span>}
      <span className="tv-pill tv-pill-note">🔗 Ghi vào sổ Tài chính · nhóm &quot;Du lịch&quot;</span>
    </div>

    {trip.budgetAmount > 0 && <div className="tv-bud">
      {EXPENSE_BUCKETS.map((group) => {
        const pct = budgets[group] > 0 ? Math.min(100, Math.round((spent[group] / budgets[group]) * 100)) : spent[group] > 0 ? 100 : 0;
        return <div key={group} className="tv-prog">
          <small>{BUCKET_LABELS[group]} <span className="tv-muted">{split[group]}%</span></small>
          <div className="tv-bar"><i className={spent[group] > budgets[group] ? "tv-over" : undefined} style={{ width: `${pct}%` }} /></div>
          <b>{vndCompact(spent[group])}/{vndCompact(budgets[group])}</b>
        </div>;
      })}
      {!editingSplit && <button type="button" className="tv-link tv-small" onClick={() => setEditingSplit(true)}>Sửa tỷ lệ chia</button>}
      {editingSplit && <div className="tv-split-edit">
        {EXPENSE_BUCKETS.map((group) => <label key={group}>{BUCKET_LABELS[group]}
          <input type="number" min={0} max={100} value={split[group]} onChange={(event) => { const pct = Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0))); onTrip({ ...trip, budgetSplit: { ...split, [group]: pct } }); }} />%
        </label>)}
        <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={() => setEditingSplit(false)}>Xong</button>
        {Object.values(split).reduce((a, b) => a + b, 0) !== 100 && <small className="tv-warn-text">Tổng {Object.values(split).reduce((a, b) => a + b, 0)}% — nên bằng 100%.</small>}
      </div>}
    </div>}

    <div className="tv-exp-add">
      <input className="tv-exp-text" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nội dung chi… (vd: ăn hải sản Bé Mặn)" maxLength={120} />
      <input className="tv-exp-amt" inputMode="numeric" value={amount} onChange={(event) => setAmount(groupAmountTyping(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="850k" />
      <select value={bucket} onChange={(event) => setBucket(event.target.value as ExpenseBucket)} aria-label="Nhóm chi">
        {EXPENSE_BUCKETS.map((group) => <option key={group} value={group}>{BUCKET_LABELS[group]}</option>)}
      </select>
      <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={add}>Ghi</button>
    </div>
    {formError && <p className="tv-error" role="alert">{formError}</p>}
    <p className="tv-hint">Mỗi khoản ghi ở đây xuất hiện đồng thời trong sổ Tài chính (một nguồn sự thật, không ghi đôi). Xoá ở đây thì dòng trong sổ cũng được gỡ.</p>

    <div className="tv-exp-list">
      {sorted.map((expense) => <div key={expense.id} className="tv-exp">
        <span className="tv-who">{BUCKET_LABELS[expense.bucket]}</span>
        <div className="tv-exp-body"><b>{expense.content}</b><small className="tv-muted">{formatVnDate(expense.occurredOn)}{expense.transactionId ? " · đã vào sổ ✓" : ""}</small></div>
        <span className="tv-exp-amount">{vnd(expense.amount)}</span>
        <button type="button" className="tv-x" onClick={() => onDelete(expense.id)} aria-label={`Xoá khoản ${expense.content}`}>🗑</button>
      </div>)}
      {sorted.length === 0 && <p className="tv-muted tv-small">Chưa có khoản chi nào — vé máy bay, đặt cọc khách sạn ghi trước cũng tính vào chuyến.</p>}
    </div>

    {planned > 0 && <div className="tv-soon">
      <b>Sắp chi theo lịch trình:</b> <span className="tv-muted">{itinerary.filter((entry) => entry.estAmount > 0).map((entry) => `${entry.title} ~${vndCompact(entry.estAmount)}`).join(" · ")} → tổng dự kiến <b>{vndCompact(total + planned)}{trip.budgetAmount > 0 ? `/${vndCompact(trip.budgetAmount)}` : ""}</b>{trip.budgetAmount > 0 && (total + planned <= trip.budgetAmount ? " ✅" : " ⚠️ vượt kế hoạch")}</span>
    </div>}
  </section>;
}
