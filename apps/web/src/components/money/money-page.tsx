"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile, trackEvent } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import { deleteMoneyItem, loadMoney, saveMoneyItem, saveMoneySettings } from "@/lib/money/client";
import { monthKey, shortVnd, summarizeMonth } from "@/lib/money/summary";
import type { MoneyBundle } from "@/lib/money/types";
import { buildAssessment, type Assessment } from "@/lib/onboarding/assessment";
import { LedgerTable } from "./ledger-table";
import { MonthView } from "./month-view";
import { RecurringGoals } from "./recurring-goals";

type Tab = "ledger" | "month" | "plan";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "ledger", label: "Sổ" }, { id: "month", label: "Tháng" }, { id: "plan", label: "Định kỳ & mục tiêu" }];
const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

/** Money home (SPEC_V2 §8–12): month header answers "how much, where, what's off"; tabs hold the ledger, the month table and the plan. */
export function MoneyPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [bundle, setBundle] = useState<MoneyBundle | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [tab, setTab] = useState<Tab>("ledger");
  const [error, setError] = useState("");

  const reload = useCallback(async (target = month) => {
    try { setBundle(await loadMoney(target)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải sổ thu chi."); }
  }, [month]);
  useEffect(() => { void reload(month); }, [month, reload]);
  const [suggested, setSuggested] = useState<Assessment["plan"] | null>(null);
  useEffect(() => { (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then((profile) => { setChildren(profile?.children ?? []); if (profile?.household) setSuggested(buildAssessment(profile).plan); }).catch(() => {}); }, []);
  // The onboarding assessment suggested a monthly plan and an emergency fund: apply each once, until the family sets its own.
  const seeded = useRef(false);
  useEffect(() => {
    if (!bundle || !suggested || seeded.current) return;
    seeded.current = true;
    const tasks: Array<Promise<unknown>> = [];
    if (!bundle.settings.monthlyPlan && suggested.monthlyPlan) tasks.push(saveMoneySettings({ ...bundle.settings, monthlyPlan: suggested.monthlyPlan }));
    if (!bundle.goals.length && suggested.emergencyTarget) tasks.push(saveMoneyItem("goals", { id: crypto.randomUUID(), name: "Quỹ dự phòng", targetAmount: suggested.emergencyTarget, savedAmount: 0, monthlyPlan: suggested.monthlySaving }));
    if (tasks.length) void Promise.all(tasks).then(() => reload()).catch(() => {});
  }, [bundle, suggested, reload]);

  const summary = bundle ? summarizeMonth(bundle) : null;
  const act = (name: string) => async <T,>(task: () => Promise<T>) => { await task(); trackEvent(name); await reload(); };

  return <div className="app-page money-page">
    <div className="app-page-head"><div><h1>Tiền</h1><p className="app-sub">Nhà mình có bao nhiêu · tiền đi đâu · có gì bất thường · nên làm gì</p></div>
      <div className="month-nav" role="group" aria-label="Chọn tháng"><button type="button" className="app-btn ghost" aria-label="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button><b>{monthLabel(month)}</b><button type="button" className="app-btn ghost" aria-label="Tháng sau" disabled={month >= monthKey(new Date())} onClick={() => setMonth(shiftMonth(month, 1))}>›</button></div></div>

    {error && <p className="form-error" role="alert">{error}{!cloudEnabled ? "" : " "}<Link href="/sign-in">{error.includes("đăng nhập") ? "Đăng nhập" : ""}</Link></p>}
    {!bundle || !summary ? <div className="app-card" aria-busy="true"><p className="app-sub">Đang tải sổ thu chi…</p></div> : <>
      <div className="app-card money-kpis">
        <div className="brief-kpi"><small>Thu</small><b>{summary.income ? shortVnd(summary.income) : "—"}</b></div>
        <div className="brief-kpi"><small>Đã chi</small><b>{summary.expense ? shortVnd(summary.expense) : "—"}</b></div>
        <div className="brief-kpi"><small>Tiết kiệm</small><b>{summary.saving ? shortVnd(summary.saving) : "—"}</b></div>
        <div className="brief-kpi"><small>{summary.plan ? "Còn lại trong kế hoạch" : "Còn lại (thu − chi − tiết kiệm)"}</small><b>{summary.plan ? shortVnd(summary.remainingOfPlan!) : summary.income || summary.expense ? shortVnd(summary.net) : "—"}</b></div>
        {summary.plan ? <div className="money-plan"><span className="bar"><span style={{ width: `${Math.min(100, Math.round(summary.expense / summary.plan * 100))}%` }} className={summary.expense > summary.plan ? "over" : undefined} /></span><small>{shortVnd(summary.expense)} / kế hoạch {shortVnd(summary.plan)}{summary.expectedExpense ? ` · dự kiến cuối tháng ${shortVnd(summary.expectedExpense)}` : ""}{summary.paceRatio && summary.paceRatio > 1.05 ? <span className="app-pill warn">Cao hơn kế hoạch</span> : summary.paceRatio ? <span className="app-pill ok">Đúng nhịp</span> : null}</small></div>
          : <div className="money-plan"><small>Chưa đặt kế hoạch chi tháng. <button type="button" className="ledger-link" onClick={() => setTab("plan")}>Đặt kế hoạch</button> để FamAgent so nhịp chi cho bạn.</small></div>}
      </div>
      <div className="app-tabs" role="tablist">{TABS.map((item) => <a key={item.id} role="tab" href={`#${item.id}`} aria-selected={tab === item.id} className={tab === item.id ? "on" : undefined} onClick={(event) => { event.preventDefault(); setTab(item.id); }}>{item.label}{item.id === "ledger" && summary.transactionCount ? ` · ${summary.transactionCount}` : ""}</a>)}</div>
      {tab === "ledger" && <LedgerTable transactions={bundle.transactions} categories={bundle.settings.categories} familyChildren={children} month={month} onSave={(item) => act("money_transaction_saved")(() => saveMoneyItem("transactions", item))} onDelete={(id) => act("money_transaction_deleted")(() => deleteMoneyItem("transactions", id))} />}
      {tab === "month" && <MonthView summary={summary} categories={bundle.settings.categories} budgets={bundle.budgets} onBudget={(item) => act("money_budget_saved")(() => saveMoneyItem("budgets", item))} onDeleteBudget={(id) => act("money_budget_deleted")(() => deleteMoneyItem("budgets", id))} />}
      {tab === "plan" && <RecurringGoals recurring={bundle.recurring} goals={bundle.goals} settings={bundle.settings} categories={bundle.settings.categories} savingsBalance={summary.balances.savings} onRecurring={(item) => act("money_recurring_saved")(() => saveMoneyItem("recurring", item))} onDeleteRecurring={(id) => act("money_recurring_deleted")(() => deleteMoneyItem("recurring", id))} onGoal={(item) => act("money_goal_saved")(() => saveMoneyItem("goals", item))} onDeleteGoal={(id) => act("money_goal_deleted")(() => deleteMoneyItem("goals", id))} onSettings={(settings) => act("money_settings_saved")(() => saveMoneySettings(settings))} />}
      <p className="app-sub money-foot">Số dư: tiền mặt {vnd(summary.balances.cash)} · tiết kiệm {vnd(summary.balances.savings)}. <Link className="brief-link" href="/agent">Hỏi FamAgent về tiền →</Link></p>
    </>}
  </div>;
}
