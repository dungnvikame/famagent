"use client";

import { useState } from "react";
import { parseVnd } from "@/lib/money/parse";
import { shortVnd } from "@/lib/money/summary";
import type { MoneyGoal, MoneySettings } from "@/lib/money/types";

interface Props {
  goals: MoneyGoal[]; settings: MoneySettings; savingsBalance: number;
  onGoal: (item: MoneyGoal) => Promise<void>; onDeleteGoal: (id: string) => Promise<void>;
  onSettings: (settings: MoneySettings) => Promise<void>;
}

/** Savings goals with time-to-target and the monthly spending plan (fixed items and balances live in Tình hình). */
export function GoalsPlan({ goals, settings, savingsBalance, onGoal, onDeleteGoal, onSettings }: Props) {
  const [error, setError] = useState("");
  const [goal, setGoal] = useState({ name: "", target: "", saved: "", plan: "" });
  const [plan, setPlan] = useState(settings.monthlyPlan ? String(settings.monthlyPlan) : "");
  const run = async (task: () => Promise<void>) => { try { setError(""); await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } };

  return <div className="money-settings">
    {error && <p className="form-error" role="alert">{error}</p>}
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

    <section className="app-section"><h2>Kế hoạch chi mỗi tháng</h2><p className="app-sub" style={{ marginBottom: 10 }}>FamAgent so nhịp chi với con số này. Số dư và khoản cố định nằm ở tab Tình hình.</p>
      <div className="app-card inline-form settings-form">
        <label>Kế hoạch chi mỗi tháng<input inputMode="decimal" placeholder="25tr" value={plan} onChange={(event) => setPlan(event.target.value)} /></label>
        <button type="button" className="app-btn" onClick={() => { const monthlyPlan = plan.trim() ? parseVnd(plan) : undefined; if (monthlyPlan === null || (monthlyPlan !== undefined && monthlyPlan <= 0)) { setError("Số tiền không hợp lệ (ví dụ 25tr)."); return; } void run(() => onSettings({ ...settings, monthlyPlan })); }}>Lưu</button>
      </div>
    </section>
  </div>;
}
