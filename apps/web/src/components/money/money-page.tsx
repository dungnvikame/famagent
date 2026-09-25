"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { ChildProfile, FamilyProfile } from "@/lib/experience/types";
import type { FrameworkId } from "@/lib/money/frameworks";
import { deleteMoneyItem, loadMoney, saveMoneyItem, saveMoneySettings } from "@/lib/money/client";
import { todayLocal } from "@/lib/money/parse";
import { syncDebtRecurring } from "@/lib/money/position";
import { guessCategory, rememberCorrections, type QuickDraft } from "@/lib/money/quick-add";
import { monthKey, recurringFor, summarizeMonth } from "@/lib/money/summary";
import type { MoneyAllocation, MoneyBundle, MoneyCategory, MoneyPosition, MoneyRecurring, MoneyTransaction } from "@/lib/money/types";
import { buildAssessment, type Assessment } from "@/lib/onboarding/assessment";
import { FrameworkPanel } from "./framework-panel";
import { GoalsPlan } from "./goals-plan";
import { LedgerTable } from "./ledger-table";
import { MonthView } from "./month-view";
import { PositionView } from "./position-view";
import { QuickAddPanel } from "./quick-add-panel";

type Tab = "situ" | "ledger" | "month" | "plan";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "situ", label: "Tình hình" }, { id: "ledger", label: "Sổ" }, { id: "month", label: "Tháng" }, { id: "plan", label: "Mục tiêu" }];
const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

/** Money home (SPEC_V2 §8–12): month header answers "how much, where, what's off"; tabs hold the position, the ledger, the month table and goals. */
export function MoneyPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [bundle, setBundle] = useState<MoneyBundle | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [tab, setTab] = useState<Tab>("ledger");
  // Deep links from Home (/money#month, /money#plan, /money#situ) open the matching tab.
  useEffect(() => { const hash = window.location.hash.slice(1); if (TABS.some((item) => item.id === hash)) setTab(hash as Tab); }, []);
  const [error, setError] = useState("");

  const reload = useCallback(async (target = month) => {
    try { setBundle(await loadMoney(target)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải sổ thu chi."); }
  }, [month]);
  useEffect(() => { void reload(month); }, [month, reload]);
  const [suggested, setSuggested] = useState<Assessment["plan"] | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  useEffect(() => { (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then((loaded) => { setProfile(loaded); setChildren(loaded?.children ?? []); if (loaded?.household) setSuggested(buildAssessment(loaded).plan); }).catch(() => {}); }, []);
  /** Saves the chosen money framework on the family profile (cloud when signed in, else this browser). */
  async function chooseMethod(moneyMethod: FrameworkId) {
    if (!profile) return;
    const next = { ...profile, household: { ...profile.household, moneyMethod }, updatedAt: new Date().toISOString() };
    setProfile(next); saveProfile(next); trackEvent("money_method_chosen", { method: moneyMethod, source: "money" });
    if (cloudEnabled) await saveCloudProfile(next).catch(() => setError("Chưa lưu được phương pháp lên máy chủ."));
  }
  // The onboarding assessment suggested a monthly plan and an emergency fund: apply each once, until the family sets its own.
  const seeded = useRef(false);
  useEffect(() => {
    if (!bundle || !suggested || seeded.current) return;
    seeded.current = true;
    const tasks: Array<Promise<unknown>> = [];
    if (!bundle.settings.monthlyPlan && suggested.monthlyPlan) tasks.push(saveMoneySettings({ ...bundle.settings, monthlyPlan: suggested.monthlyPlan }));
    if (!bundle.goals.length && suggested.emergencyTarget) tasks.push(saveMoneyItem("goals", { id: crypto.randomUUID(), name: "Quỹ dự phòng", targetAmount: suggested.emergencyTarget, savedAmount: 0 }));
    if (tasks.length) void Promise.all(tasks).then(() => reload()).catch(() => {});
  }, [bundle, suggested, reload]);

  const summary = bundle ? summarizeMonth(bundle) : null;
  const act = (name: string) => async <T,>(task: () => Promise<T>) => { await task(); trackEvent(name); await reload(); };
  const quickContext = bundle ? { categories: bundle.settings.categories, memory: bundle.settings.categoryMemory, existing: bundle.transactions, children: children.map((child) => child.name).filter((name): name is string => Boolean(name?.trim())) } : null;

  const debtRecurringIds = new Set((bundle?.settings.position?.debts ?? []).map((debt) => debt.recurringId).filter((id): id is string => Boolean(id)));

  /**
   * One ledger entry + its "Hằng tháng" choice: on = create (or re-enable and update) the linked monthly item,
   * off = pause it so later months stop posting (entries already written stay). Debt-owned items are left alone.
   */
  async function saveEntry(item: MoneyTransaction, repeat: { on: boolean; day: number }) {
    if (!bundle) return;
    const linked = item.recurringId ? bundle.recurring.find((rec) => rec.id === item.recurringId) : undefined;
    let recurringId = item.recurringId;
    if (!(linked && debtRecurringIds.has(linked.id))) {
      if (repeat.on && item.amount > 0) {
        const next = linked ? { ...linked, active: true, name: item.content, kind: item.kind, category: item.category, amount: Math.abs(item.amount), dayOfMonth: repeat.day } : recurringFor(item, repeat.day, crypto.randomUUID());
        await saveMoneyItem("recurring", next);
        recurringId = next.id;
      } else if (!repeat.on && linked?.active) await saveMoneyItem("recurring", { ...linked, active: false });
    }
    await saveMoneyItem("transactions", { ...item, recurringId });
  }

  /** Quick add: writes the selected lines (and their monthly items), then remembers any category the family corrected. */
  async function saveQuick(drafts: QuickDraft[]) {
    if (!bundle) return;
    for (const draft of drafts.filter((item) => item.selected)) {
      await saveEntry({ id: crypto.randomUUID(), occurredOn: draft.occurredOn, content: draft.content.trim(), category: draft.category, kind: draft.kind, amount: draft.amount, forChild: draft.forChild, source: "manual" }, { on: draft.repeat, day: Number(draft.occurredOn.slice(8, 10)) || 1 });
    }
    const categoryMemory = rememberCorrections(bundle.settings.categoryMemory, drafts);
    if (categoryMemory) await saveMoneySettings({ ...bundle.settings, categoryMemory });
    await reload();
  }

  async function addCategory(category: MoneyCategory) {
    if (!bundle) return;
    if (bundle.settings.categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) {
      await saveMoneySettings({ ...bundle.settings, categories: bundle.settings.categories.map((item) => item.name.toLowerCase() === category.name.toLowerCase() ? { ...item, archived: undefined } : item) });
    } else await saveMoneySettings({ ...bundle.settings, categories: [...bundle.settings.categories, category] });
    trackEvent("money_category_added", { from: "quick_add" });
    await reload();
  }

  async function saveCustom(allocation: MoneyAllocation, categories: MoneyCategory[]) {
    if (!bundle) return;
    await saveMoneySettings({ ...bundle.settings, allocation, categories });
    await chooseMethod("custom");
    trackEvent("money_custom_split_saved", { parts: allocation.buckets.length });
    await reload();
  }

  /** Position: debt payments become recurring items; fixed items from the setup are created with a guessed category. */
  async function savePosition(position: MoneyPosition, newFixed: Array<Omit<MoneyRecurring, "id" | "active" | "category"> & { category?: string }>) {
    if (!bundle) return;
    const today = todayLocal(); const day = Number(today.slice(8, 10));
    const active = bundle.settings.categories.filter((item) => item.kind === "expense" && !item.archived).map((item) => item.name);
    const sync = syncDebtRecurring(position.debts, bundle.settings.position?.debts ?? [], bundle.recurring, active, today, () => crypto.randomUUID());
    for (const item of sync.upserts) await saveMoneyItem("recurring", item);
    for (const id of sync.deletes) await deleteMoneyItem("recurring", id);
    const context = { today, categories: bundle.settings.categories, memory: bundle.settings.categoryMemory, existing: bundle.transactions };
    for (const item of newFixed) {
      const kind = item.kind === "income" ? "income" : "expense";
      // A fixed item whose day already passed is part of the balance the family just typed: count it as posted.
      await saveMoneyItem("recurring", { id: crypto.randomUUID(), name: item.name, kind, category: item.category ?? guessCategory(item.name, kind, context), amount: item.amount, dayOfMonth: item.dayOfMonth, active: true, lastPostedMonth: item.dayOfMonth <= day ? today.slice(0, 7) : undefined });
    }
    await saveMoneySettings({ ...bundle.settings, position: { ...position, debts: sync.debts } });
    trackEvent("money_position_saved", { accounts: position.accounts.length, debts: position.debts.length, fixed: newFixed.length });
    await reload();
  }

  return <div className="app-page money-page">
    <div className="app-page-head"><div><h1>Tài chính</h1><p className="app-sub">Nhà mình có bao nhiêu · tiền đi đâu · có gì bất thường · nên làm gì</p></div>
      <div className="month-nav" role="group" aria-label="Chọn tháng"><button type="button" className="app-btn ghost" aria-label="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button><b>{monthLabel(month)}</b><button type="button" className="app-btn ghost" aria-label="Tháng sau" disabled={month >= monthKey(new Date())} onClick={() => setMonth(shiftMonth(month, 1))}>›</button></div></div>

    {error && <p className="form-error" role="alert">{error}{!cloudEnabled ? "" : " "}<Link href="/sign-in">{error.includes("đăng nhập") ? "Đăng nhập" : ""}</Link></p>}
    {!bundle || !summary || !quickContext ? <div className="app-card" aria-busy="true"><p className="app-sub">Đang tải sổ thu chi…</p></div> : <>
      <div className="app-card money-kpis">
        <div className="brief-kpi"><small>Thu</small><b>{summary.income ? vnd(summary.income) : "—"}</b></div>
        <div className="brief-kpi"><small>Đã chi</small><b>{summary.expense ? vnd(summary.expense) : "—"}</b></div>
        <div className="brief-kpi"><small>Tiết kiệm</small><b>{summary.saving ? vnd(summary.saving) : "—"}</b></div>
        <div className="brief-kpi"><small>{summary.plan ? "Còn lại trong kế hoạch" : "Còn lại (thu − chi − tiết kiệm)"}</small><b>{summary.plan ? vnd(summary.remainingOfPlan!) : summary.income || summary.expense ? vnd(summary.net) : "—"}</b></div>
        {summary.plan ? <div className="money-plan"><span className="bar"><span style={{ width: `${Math.min(100, Math.round(summary.expense / summary.plan * 100))}%` }} className={summary.expense > summary.plan ? "over" : undefined} /></span><small>{vnd(summary.expense)} / kế hoạch {vnd(summary.plan)}{summary.expectedExpense ? ` · dự kiến cuối tháng ${vnd(summary.expectedExpense)}` : ""}{summary.paceRatio && summary.paceRatio > 1.05 ? <span className="app-pill warn">Cao hơn kế hoạch</span> : summary.paceRatio ? <span className="app-pill ok">Đúng nhịp</span> : null}</small></div>
          : <div className="money-plan"><small>Chưa đặt kế hoạch chi tháng. <button type="button" className="ledger-link" onClick={() => setTab("plan")}>Đặt kế hoạch</button> để FamAgent so nhịp chi cho bạn.</small></div>}
      </div>
      {profile && <FrameworkPanel profile={profile} summary={summary} bundle={bundle} onChoose={(id) => void chooseMethod(id)} onSaveCustom={saveCustom} />}
      <div className="app-tabs" role="tablist">{TABS.map((item) => <a key={item.id} role="tab" href={`#${item.id}`} aria-selected={tab === item.id} className={tab === item.id ? "on" : undefined} onClick={(event) => { event.preventDefault(); setTab(item.id); }}>{item.label}{item.id === "ledger" && summary.transactionCount ? ` · ${summary.transactionCount}` : ""}</a>)}</div>
      {tab === "situ" && <PositionView key={`${bundle.settings.position?.asOf ?? "none"}:${bundle.settings.position?.accounts.length ?? 0}:${bundle.settings.position?.debts.length ?? 0}`} bundle={bundle} summary={summary} estimatedIncome={profile?.household?.monthlyIncome ?? 0} onSavePosition={savePosition} onRecurring={(item) => act("money_recurring_saved")(() => saveMoneyItem("recurring", item))} onDeleteRecurring={(id) => act("money_recurring_deleted")(() => deleteMoneyItem("recurring", id))} />}
      {tab === "ledger" && <>
        {!bundle.settings.position && <div className="banner"><span>Nhập tình hình hiện tại để FamAgent tính đúng số dư, nợ và khoản cố định.</span><button type="button" className="app-btn ghost" onClick={() => setTab("situ")}>Nhập ngay</button></div>}
        <QuickAddPanel context={quickContext} aiConsent={Boolean(profile?.aiConsent)} onSave={saveQuick} onCreateCategory={addCategory} />
        <LedgerTable transactions={bundle.transactions} categories={bundle.settings.categories} familyChildren={children} month={month} openingCash={summary.balances.cash - summary.net} recurring={bundle.recurring} debtRecurringIds={debtRecurringIds} onSave={(item, repeat) => act(repeat.on ? "money_transaction_saved_monthly" : "money_transaction_saved")(() => saveEntry(item, repeat))} onDelete={(id) => act("money_transaction_deleted")(() => deleteMoneyItem("transactions", id))} />
      </>}
      {tab === "month" && <MonthView summary={summary} categories={bundle.settings.categories} budgets={bundle.budgets} onBudget={(item) => act("money_budget_saved")(() => saveMoneyItem("budgets", item))} onDeleteBudget={(id) => act("money_budget_deleted")(() => deleteMoneyItem("budgets", id))} />}
      {tab === "plan" && <GoalsPlan goals={bundle.goals} settings={bundle.settings} savingsBalance={summary.balances.savings} onGoal={(item) => act("money_goal_saved")(() => saveMoneyItem("goals", item))} onDeleteGoal={(id) => act("money_goal_deleted")(() => deleteMoneyItem("goals", id))} onSettings={(settings) => act("money_settings_saved")(() => saveMoneySettings(settings))} />}
      <p className="app-sub money-foot">Số dư: tiền tiêu {vnd(summary.balances.cash)} · tiết kiệm {vnd(summary.balances.savings)}. <Link className="brief-link" href="/agent">Hỏi FamAgent về tiền →</Link></p>
    </>}
  </div>;
}
