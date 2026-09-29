"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { ChildProfile, FamilyProfile } from "@/lib/experience/types";
import type { FrameworkId } from "@/lib/money/frameworks";
import { deleteMoneyItem, loadMoney, loadRange, saveMoneyItem, saveMoneySettings } from "@/lib/money/client";
import { categoryAverages, potsOf, runningPots } from "@/lib/money/history";
import { applyFilter, monthRange, type LedgerFilter } from "@/lib/money/ledger-filter";
import { formatVnDate, todayLocal } from "@/lib/money/parse";
import { debtTotals, syncDebtRecurring } from "@/lib/money/position";
import { autoDebtId } from "@/lib/money/debt-link";
import { saveNewEntry } from "@/lib/money/save-entry";
import { guessCategory, rememberCorrections, type QuickDraft } from "@/lib/money/quick-add";
import { monthKey, recurringFor, summarizeMonth } from "@/lib/money/summary";
import type { MoneyAllocation, MoneyBundle, MoneyCategory, MoneyDebt, MoneyPosition, MoneyRange, MoneyRecurring, MoneyTransaction } from "@/lib/money/types";
import { buildAssessment, type Assessment } from "@/lib/onboarding/assessment";
import { DebtsView } from "./debts-view";
import { FrameworkPanel } from "./framework-panel";
import { GoalsPlan } from "./goals-plan";
import { LedgerFilters } from "./ledger-filters";
import { LedgerTable } from "./ledger-table";
import { DueFlow } from "./due-flow";
import { MoneyHero } from "./money-hero";
import { MONEY_CHANGED_EVENT } from "./quick-entry";
import { MonthView } from "./month-view";
import { PlanView } from "./plan-view";
import { PositionView } from "./position-view";
import { QuickAddPanel } from "./quick-add-panel";
import { SavingsBackfill } from "./savings-backfill";

type Tab = "situ" | "ledger" | "month" | "debt" | "plan";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "ledger", label: "Sổ" }, { id: "month", label: "Tháng" }, { id: "debt", label: "Nợ" }, { id: "plan", label: "Kế hoạch" }, { id: "situ", label: "Tình hình" }];
const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

/** Money home (SPEC_V2 §8–12): month header answers "how much, where, what's off"; tabs hold the position, the ledger, the month table and goals. */
export function MoneyPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [bundle, setBundle] = useState<MoneyBundle | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [tab, setTab] = useState<Tab>("ledger");
  // "Chi tiết số dư" (savings + account balance after each entry) is off until the family asks for it.
  const [balanceOpen, setBalanceOpenState] = useState(false);
  useEffect(() => { try { setBalanceOpenState(localStorage.getItem("famagent:ledger-balance") === "1"); } catch { /* storage blocked */ } }, []);
  const setBalanceOpen = (open: boolean) => { setBalanceOpenState(open); try { localStorage.setItem("famagent:ledger-balance", open ? "1" : "0"); } catch { /* storage blocked */ } };
  // Deep links from Home (/money#month, /money#plan, /money#situ) open the matching tab.
  useEffect(() => { const hash = window.location.hash.slice(1); if (TABS.some((item) => item.id === hash)) setTab(hash as Tab); }, []);
  const [error, setError] = useState("");
  // Sổ filter: defaults to the month being viewed; a range outside it loads those entries separately.
  const [filter, setFilter] = useState<LedgerFilter>(() => ({ kinds: [], categories: [], ...monthRange(monthKey(new Date())), text: "" }));
  const [range, setRange] = useState<MoneyRange | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  useEffect(() => { setFilter({ kinds: [], categories: [], ...monthRange(month), text: "" }); }, [month]);
  const outsideMonth = !filter.from.startsWith(month) || !filter.to.startsWith(month);
  const loadFilterRange = useCallback(async () => {
    if (!outsideMonth) { setRange(null); return; }
    setRangeLoading(true);
    try { setRange(await loadRange(filter.from, filter.to)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải các khoản."); }
    finally { setRangeLoading(false); }
  }, [outsideMonth, filter.from, filter.to]);
  useEffect(() => { void loadFilterRange(); }, [loadFilterRange]);

  const reload = useCallback(async (target = month) => {
    try { setBundle(await loadMoney(target)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải sổ thu chi."); }
    void loadFilterRange();
  }, [month, loadFilterRange]);
  useEffect(() => { void reload(month); }, [month, reload]);
  // The "Ghi khoản" sheet (any page) wrote or undid an entry.
  useEffect(() => {
    const onChanged = () => { void reload(month); };
    window.addEventListener(MONEY_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(MONEY_CHANGED_EVENT, onChanged);
  }, [month, reload]);
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
  const act = (name: string) => async <T,>(task: () => Promise<T>) => { const result = await task(); trackEvent(name); await reload(); return result; };
  const quickContext = bundle ? { categories: bundle.settings.categories, memory: bundle.settings.categoryMemory, existing: bundle.transactions, children: children.map((child) => child.name).filter((name): name is string => Boolean(name?.trim())) } : null;

  // Entries in the filter's date range, their running cash, and what the filters leave.
  const source = outsideMonth ? range?.transactions ?? [] : bundle?.transactions ?? [];
  const opening = outsideMonth ? range?.openingCash ?? 0 : summary ? summary.balances.cash - summary.cashChange : 0;
  const openingSavings = outsideMonth ? range?.openingSavings ?? 0 : summary ? summary.balances.savings - summary.savingsChange : 0;
  const balances = runningPots(source, opening, openingSavings);
  const inRange = source.filter((tx) => tx.occurredOn >= filter.from && tx.occurredOn <= filter.to);
  const monthlyIds = new Set((bundle?.recurring ?? []).filter((item) => item.active).map((item) => item.id));
  const shown = applyFilter(source, filter, monthlyIds);
  // The running balance only reads right when no entry between two rows is hidden (a date range alone is fine).
  const showBalance = !filter.kinds.length && !filter.categories.length && !filter.text.trim() && !filter.forChild && !filter.monthly && filter.min === undefined && filter.max === undefined;
  // Only meaningful once the family has said where it stands (a position): before that, a negative balance just means no opening balance yet.
  const firstNegative = showBalance && bundle?.settings.position ? [...shown].reverse().find((tx) => (balances.get(tx.id)?.account ?? 0) < 0) : undefined;
  // "Tiền đang có" at the end of the month viewed, and how much more was spent out of savings during that month.
  const pots = summary ? potsOf(summary.balances.cash, summary.balances.savings) : undefined;
  // What the family owes (ledger loans + Tình hình debts) and what others owe it.
  const debts = bundle ? debtTotals(bundle) : undefined;
  const filterInsight = (() => {
    // One comparison when a single expense category is viewed over the whole month.
    if (!bundle?.history || filter.categories.length !== 1 || outsideMonth) return undefined;
    const name = filter.categories[0]; const average = categoryAverages(bundle.history, month)[name];
    const spent = inRange.filter((tx) => tx.kind === "expense" && tx.category === name).reduce((total, tx) => total + tx.amount, 0);
    if (!average || !spent || filter.from !== monthRange(month).from || filter.to !== monthRange(month).to) return undefined;
    const change = Math.round((spent / average - 1) * 100);
    return Math.abs(change) < 5 ? `${name} tháng này gần bằng trung bình 3 tháng` : `${name} tháng này ${change > 0 ? "cao" : "thấp"} hơn trung bình 3 tháng ${Math.abs(change)}%`;
  })();

  const debtRecurringIds = new Set((bundle?.settings.position?.debts ?? []).map((debt) => debt.recurringId).filter((id): id is string => Boolean(id)));

  /**
   * One ledger entry + its "Hằng tháng" choice: on = create (or re-enable and update) the linked monthly item,
   * off = pause it so later months stop posting (entries already written stay). Debt-owned items are left alone.
   */
  async function saveEntry(item: MoneyTransaction, repeat: { on: boolean; day: number }): Promise<{ answered: string | null } | void> {
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
    return saveTransaction({ ...item, recurringId });
  }

  /** Writes one entry; a repayment whose wording names exactly one Tình hình debt is tagged with it so that debt goes down. */
  async function saveTransaction(item: MoneyTransaction): Promise<{ answered: string | null }> {
    const debtId = item.debtId ?? autoDebtId(item, bundle?.settings.position?.debts ?? []);
    const entry = debtId ? { ...item, debtId } : item;
    // A new manual entry that matches a waiting fixed item answers that period instead of adding a second entry.
    if (bundle && !source.some((tx) => tx.id === entry.id)) return { answered: (await saveNewEntry(bundle, entry)).answered?.name ?? null };
    await saveMoneyItem("transactions", entry);
    return { answered: null };
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

  /** An old debt from the Nợ tab: joins the position's debts (a balance as of today, never a ledger entry) and gets its reminder. */
  async function addDebt(debt: MoneyDebt) {
    const position = bundle?.settings.position;
    if (!position) return;
    await savePosition({ ...position, debts: [...position.debts, debt] }, []);
    trackEvent("money_debt_added");
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
      {tab !== "month" && pots && <MoneyHero summary={summary} pots={pots} debts={debts} current={month === monthKey(new Date())} today={{ day: new Date().getDate(), days: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }} onPlan={() => setTab("plan")} />}
      {tab !== "month" && <DueFlow bundle={bundle} summary={summary} onChanged={() => reload()} />}
      <div className="app-tabs" role="tablist">{TABS.map((item) => <a key={item.id} role="tab" href={`#${item.id}`} aria-selected={tab === item.id} className={tab === item.id ? "on" : undefined} onClick={(event) => { event.preventDefault(); setTab(item.id); }}>{item.label}{item.id === "ledger" && summary.transactionCount ? ` · ${summary.transactionCount}` : ""}</a>)}</div>
      {tab === "situ" && <SavingsBackfill recurring={bundle.recurring} onDone={() => reload()} />}
      {tab === "situ" && <PositionView key={`${bundle.settings.position?.asOf ?? "none"}:${bundle.settings.position?.accounts.length ?? 0}:${bundle.settings.position?.debts.length ?? 0}`} bundle={bundle} summary={summary} estimatedIncome={profile?.household?.monthlyIncome ?? 0} onSavePosition={savePosition} onTab={(next) => setTab(next)} onRecurring={(item) => act("money_recurring_saved")(() => saveMoneyItem("recurring", item))} onDeleteRecurring={(id) => act("money_recurring_deleted")(() => deleteMoneyItem("recurring", id))} />}
      {tab === "ledger" && <>
        {!bundle.settings.position && <div className="banner"><span>Nhập tình hình hiện tại để FamAgent tính đúng số dư, nợ và khoản cố định.</span><button type="button" className="app-btn ghost" onClick={() => setTab("situ")}>Nhập ngay</button></div>}
        <QuickAddPanel context={quickContext} aiConsent={Boolean(profile?.aiConsent)} onSave={saveQuick} onCreateCategory={addCategory} />
        <LedgerFilters filter={filter} onChange={setFilter} month={month} today={todayLocal()} categories={bundle.settings.categories} inRange={inRange} shown={shown} loading={rangeLoading} insight={filterInsight} balanceHidden={!showBalance} />
        {firstNegative && balanceOpen && <div className="banner warn-banner"><span>Số dư tài khoản âm từ {formatVnDate(firstNegative.occurredOn)}: có thể thiếu khoản thu trước đó, hoặc số dư đầu kỳ chưa đúng.</span><button type="button" className="app-btn ghost" onClick={() => setTab("situ")}>Kiểm tra số dư</button></div>}
        <LedgerTable guessContext={quickContext} transactions={shown} balances={balances} showBalance={showBalance} balanceOpen={balanceOpen} onBalanceOpen={setBalanceOpen} emptyText={source.length ? "Không có khoản nào khớp bộ lọc." : undefined} categories={bundle.settings.categories} familyChildren={children} month={month} recurring={bundle.recurring} debtRecurringIds={debtRecurringIds} onSave={(item, repeat) => act(repeat.on ? "money_transaction_saved_monthly" : "money_transaction_saved")(() => saveEntry(item, repeat))} onDelete={(id) => act("money_transaction_deleted")(() => deleteMoneyItem("transactions", id))} />
      </>}
      {tab === "month" && <MonthView summary={summary} bundle={bundle} openingCash={summary.balances.cash - summary.cashChange} onBudget={(item) => act("money_budget_saved")(() => saveMoneyItem("budgets", item))} onDeleteBudget={(id) => act("money_budget_deleted")(() => deleteMoneyItem("budgets", id))} onOpenLedger={(category) => { setFilter({ kinds: [], categories: category ? [category] : [], ...monthRange(month), text: "" }); setTab("ledger"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onTab={(next) => setTab(next)} />}
      {tab === "debt" && <DebtsView bundle={bundle} onSave={async (item) => { await act("money_loan_saved")(() => saveTransaction(item)); }} onTab={(next) => setTab(next)} onAddDebt={addDebt} />}
      {tab === "plan" && <PlanView bundle={bundle} summary={summary} month={month}
        onSettings={async (settings) => { await act("money_saving_set")(() => saveMoneySettings(settings)); }}
        onRecurring={async (item) => { await act("money_recurring_saved")(() => saveMoneyItem("recurring", item)); }}
        onDeleteRecurring={async (id) => { await act("money_recurring_deleted")(() => deleteMoneyItem("recurring", id)); }}
        onBudget={async (item) => { await act("money_budget_saved")(() => saveMoneyItem("budgets", item)); }}
        onDeleteBudget={async (id) => { await act("money_budget_deleted")(() => deleteMoneyItem("budgets", id)); }}
        frameworkSlot={profile ? <FrameworkPanel profile={profile} summary={summary} bundle={bundle} onChoose={(id) => void chooseMethod(id)} onSaveCustom={saveCustom} /> : undefined}
        goalsSlot={<GoalsPlan goals={bundle.goals} onGoal={(item) => act("money_goal_saved")(() => saveMoneyItem("goals", item))} onDeleteGoal={(id) => act("money_goal_deleted")(() => deleteMoneyItem("goals", id))} />} />}
      <p className="app-sub money-foot">Số dư: tiền tiêu {vnd(summary.balances.cash)} · tiết kiệm {vnd(summary.balances.savings)}. <Link className="brief-link" href="/agent">Hỏi FamAgent về tiền →</Link></p>
    </>}
  </div>;
}
