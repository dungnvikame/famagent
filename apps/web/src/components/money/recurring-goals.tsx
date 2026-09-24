"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { parseVnd } from "@/lib/money/parse";
import { shortVnd } from "@/lib/money/summary";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyCategory, type MoneyGoal, type MoneyKind, type MoneyRecurring, type MoneySettings } from "@/lib/money/types";

interface Props {
  recurring: MoneyRecurring[]; goals: MoneyGoal[]; settings: MoneySettings; categories: MoneyCategory[]; savingsBalance: number;
  onRecurring: (item: MoneyRecurring) => Promise<void>; onDeleteRecurring: (id: string) => Promise<void>;
  onGoal: (item: MoneyGoal) => Promise<void>; onDeleteGoal: (id: string) => Promise<void>;
  onSettings: (settings: MoneySettings) => Promise<void>;
}

/** Recurring items (auto-posted when due), savings goals with time-to-target, and opening balances / monthly plan. */
export function RecurringGoals({ recurring, goals, settings, categories, savingsBalance, onRecurring, onDeleteRecurring, onGoal, onDeleteGoal, onSettings }: Props) {
  const [error, setError] = useState("");
  const [rec, setRec] = useState({ name: "", kind: "expense" as MoneyKind, category: "", amount: "", day: "1" });
  const [goal, setGoal] = useState({ name: "", target: "", saved: "", plan: "" });
  const [plan, setPlan] = useState({ monthlyPlan: settings.monthlyPlan ? String(settings.monthlyPlan) : "", openingCash: String(settings.openingCash || ""), openingSavings: String(settings.openingSavings || "") });
  const options = (kind: MoneyKind) => kind === "saving" ? SAVING_CATEGORIES : categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  const run = async (task: () => Promise<void>) => { try { setError(""); await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } };

  return <div className="money-settings">
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="app-section"><h2>Khoản định kỳ</h2><p className="app-sub" style={{ marginBottom: 10 }}>Tự ghi vào sổ khi tới ngày — bạn không phải nhớ.</p>
      <div className="app-card app-rows">
        {recurring.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{MONEY_KIND_LABELS[item.kind]} · {item.category} · ngày {item.dayOfMonth} hằng tháng{item.lastPostedMonth ? ` · đã ghi ${item.lastPostedMonth.slice(5)}/${item.lastPostedMonth.slice(0, 4)}` : ""}</small></span><span className="row-actions"><b>{vnd(item.amount)}</b><button type="button" className="ledger-link" onClick={() => void run(() => onRecurring({ ...item, active: !item.active }))}>{item.active ? "Tạm dừng" : "Bật lại"}</button><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa “${item.name}”?`)) void run(() => onDeleteRecurring(item.id)); }}>Xóa</button></span></div>)}
        <div className="inline-form">
          <input aria-label="Tên khoản" placeholder="Internet, Tiền nhà, Lương…" value={rec.name} maxLength={80} onChange={(event) => setRec({ ...rec, name: event.target.value })} />
          <select aria-label="Loại" value={rec.kind} onChange={(event) => setRec({ ...rec, kind: event.target.value as MoneyKind, category: "" })}>{(Object.keys(MONEY_KIND_LABELS) as MoneyKind[]).map((kind) => <option key={kind} value={kind}>{MONEY_KIND_LABELS[kind]}</option>)}</select>
          <select aria-label="Nhóm" value={rec.category} onChange={(event) => setRec({ ...rec, category: event.target.value })}><option value="">{options(rec.kind)[0]}</option>{options(rec.kind).slice(1).map((name) => <option key={name}>{name}</option>)}</select>
          <input aria-label="Số tiền" inputMode="decimal" placeholder="450k" value={rec.amount} onChange={(event) => setRec({ ...rec, amount: event.target.value })} />
          <label className="day-field">Ngày <input type="number" min={1} max={31} aria-label="Ngày trong tháng" value={rec.day} onChange={(event) => setRec({ ...rec, day: event.target.value })} /></label>
          <button type="button" className="app-btn" onClick={() => { const amount = parseVnd(rec.amount); const day = Number(rec.day); if (!rec.name.trim() || amount === null || amount <= 0 || !(day >= 1 && day <= 31)) { setError("Điền tên, số tiền (ví dụ 450k) và ngày 1–31."); return; } void run(async () => { await onRecurring({ id: crypto.randomUUID(), name: rec.name.trim(), kind: rec.kind, category: rec.category || options(rec.kind)[0], amount, dayOfMonth: day, active: true }); setRec({ name: "", kind: "expense", category: "", amount: "", day: "1" }); }); }}>Thêm</button>
        </div>
      </div>
    </section>

    <section className="app-section"><h2>Mục tiêu tiết kiệm</h2>
      <div className="app-card app-rows">
        {goals.map((item) => { const saved = item.savedAmount || savingsBalance; const left = Math.max(0, item.targetAmount - saved); const months = item.monthlyPlan ? Math.ceil(left / item.monthlyPlan) : null; return <div key={item.id}><span className="budget-name"><b>{item.name}</b><small>{shortVnd(saved)} / {shortVnd(item.targetAmount)}{months !== null ? left === 0 ? " · đã đạt" : ` · với ${shortVnd(item.monthlyPlan!)}/tháng sẽ đạt sau ~${months} tháng` : ""}</small><span className="bar"><span style={{ width: `${Math.min(100, Math.round(saved / item.targetAmount * 100))}%` }} /></span></span><span className="row-actions"><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa mục tiêu “${item.name}”?`)) void run(() => onDeleteGoal(item.id)); }}>Xóa</button></span></div>; })}
        <div className="inline-form">
          <input aria-label="Tên mục tiêu" placeholder="Quỹ dự phòng" value={goal.name} maxLength={80} onChange={(event) => setGoal({ ...goal, name: event.target.value })} />
          <input aria-label="Số tiền mục tiêu" inputMode="decimal" placeholder="Mục tiêu 100tr" value={goal.target} onChange={(event) => setGoal({ ...goal, target: event.target.value })} />
          <input aria-label="Đã có" inputMode="decimal" placeholder="Đã có (trống = số dư tiết kiệm)" value={goal.saved} onChange={(event) => setGoal({ ...goal, saved: event.target.value })} />
          <input aria-label="Mỗi tháng" inputMode="decimal" placeholder="Góp/tháng 5tr" value={goal.plan} onChange={(event) => setGoal({ ...goal, plan: event.target.value })} />
          <button type="button" className="app-btn" onClick={() => { const target = parseVnd(goal.target); const saved = goal.saved.trim() ? parseVnd(goal.saved) : 0; const monthly = goal.plan.trim() ? parseVnd(goal.plan) : null; if (!goal.name.trim() || target === null || target <= 0 || saved === null || saved < 0 || (goal.plan.trim() && (monthly === null || monthly <= 0))) { setError("Điền tên và số tiền mục tiêu (ví dụ 100tr)."); return; } void run(async () => { await onGoal({ id: crypto.randomUUID(), name: goal.name.trim(), targetAmount: target, savedAmount: saved, monthlyPlan: monthly ?? undefined }); setGoal({ name: "", target: "", saved: "", plan: "" }); }); }}>Thêm</button>
        </div>
      </div>
    </section>

    <section className="app-section"><h2>Kế hoạch & số dư đầu kỳ</h2>
      <div className="app-card inline-form settings-form">
        <label>Kế hoạch chi mỗi tháng<input inputMode="decimal" placeholder="25tr" value={plan.monthlyPlan} onChange={(event) => setPlan({ ...plan, monthlyPlan: event.target.value })} /></label>
        <label>Tiền mặt/tài khoản đầu kỳ<input inputMode="decimal" placeholder="1tr" value={plan.openingCash} onChange={(event) => setPlan({ ...plan, openingCash: event.target.value })} /></label>
        <label>Tiết kiệm đầu kỳ<input inputMode="decimal" placeholder="20tr" value={plan.openingSavings} onChange={(event) => setPlan({ ...plan, openingSavings: event.target.value })} /></label>
        <button type="button" className="app-btn" onClick={() => { const monthlyPlan = plan.monthlyPlan.trim() ? parseVnd(plan.monthlyPlan) : undefined; const openingCash = plan.openingCash.trim() ? parseVnd(plan.openingCash) : 0; const openingSavings = plan.openingSavings.trim() ? parseVnd(plan.openingSavings) : 0; if (monthlyPlan === null || (monthlyPlan !== undefined && monthlyPlan <= 0) || openingCash === null || openingSavings === null) { setError("Số tiền không hợp lệ (ví dụ 25tr)."); return; } void run(() => onSettings({ ...settings, monthlyPlan, openingCash, openingSavings })); }}>Lưu</button>
      </div>
    </section>
  </div>;
}
