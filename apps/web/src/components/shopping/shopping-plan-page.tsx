"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { loadMoney } from "@/lib/money/client";
import { monthKey, shortVnd, summarizeMonth, type MonthSummary } from "@/lib/money/summary";
import { deleteItem, loadShopping, saveItem } from "@/lib/shopping/item-client";
import { estimateItems, itemRateResolver, localDate, type ItemEstimate } from "@/lib/shopping/items";
import { deletePurchase } from "@/lib/shopping/purchase-client";
import type { ShoppingState } from "@/lib/shopping/state";
import type { MoneyTransaction } from "@/lib/money/types";
import { mergePlan, proposePlan, shiftMonth } from "@/lib/shopping/plan";
import { SHOPPING_CATEGORIES, unlinkedTransactions } from "@/lib/shopping/reconcile";
import { MonthPlan } from "./month-plan";
import { ReconcileCard } from "./reconcile-card";
import { StockCheck } from "./stock-check";
import { HabitsPanel } from "./habits-panel";
import { StageList } from "./stage-list";
import { paydays, saleDays, waitForSale } from "@/lib/shopping/calendar";
import { benchmarkNote } from "@/lib/shopping/insights";
import { upcomingStages } from "@/lib/shopping/stages";
import { addDays } from "@/lib/shopping/items";
import { childAgeMonths } from "@/lib/experience/profile-mapper";
import type { MoneyRecurring } from "@/lib/money/types";
import { planTotal } from "@/lib/shopping/plan";
import { ItemCard } from "./item-card";
import { MarkPurchased } from "./mark-purchased";
import { DATA_CHANGED, openInbox } from "@/components/inbox/inbox";
import { PushToggle } from "@/components/push-toggle";
import { StarterItems } from "./starter-items";
import { UpcomingTimeline } from "./upcoming-timeline";

const dayLabel = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

/**
 * Shopping = our family's own shopping plan and behaviour (plans/260924-1431-shopping-plan-redesign): capture a
 * purchase in one sentence, see what runs out next, and what each item costs and how fast it goes. No catalog here —
 * the catalog opens from an item ("Tìm lựa chọn khác").
 */
export function ShoppingPlanPage() {
  const [state, setState] = useState<ShoppingState | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [money, setMoney] = useState<MonthSummary | null>(null);
  const [ledger, setLedger] = useState<MoneyTransaction[]>([]);
  const [recurring, setRecurring] = useState<MoneyRecurring[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setState(await loadShopping()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu mua sắm."); setState((current) => current ?? { items: [], purchases: [], checks: [], plan: [], dismissed: [] }); }
    // Ledger: this month for the totals, this + last month for "khoản này là mua gì?".
    const current = monthKey(new Date());
    Promise.all([loadMoney(current), loadMoney(shiftMonth(current, -1))]).then(([now, previous]) => { setMoney(summarizeMonth(now)); setLedger([...now.transactions, ...previous.transactions]); setRecurring(now.recurring); }).catch(() => {});
  }, []);
  useEffect(() => { void reload(); (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then(setProfile).catch(() => {}); }, [reload]);
  // The global Inbox writes purchases/expenses: refresh when it says so.
  useEffect(() => { const refresh = () => void reload(); window.addEventListener(DATA_CHANGED, refresh); return () => window.removeEventListener(DATA_CHANGED, refresh); }, [reload]);

  if (!state) return <div className="app-page" aria-busy="true"><p className="app-sub">Đang tải kế hoạch mua sắm…</p></div>;
  const children = profile?.children ?? [];
  const now = new Date();
  const today = localDate(now);
  const estimates: ItemEstimate[] = estimateItems(state.items, state.purchases, itemRateResolver(profile, now), now, state.checks);
  const plan = mergePlan(proposePlan(estimates, monthKey(now), today), state.plan, monthKey(now));
  const unlinked = unlinkedTransactions(ledger, state.purchases, state.dismissed).slice(0, 3);
  const month = monthKey(now);
  const monthPurchases = state.purchases.filter((purchase) => purchase.purchasedOn.startsWith(month));
  const lines = money?.byCategory.filter((line) => SHOPPING_CATEGORIES.includes(line.category)) ?? [];
  const spent = lines.reduce((sum, line) => sum + line.spent, 0);
  const limit = lines.reduce((sum, line) => sum + (line.limit ?? 0), 0);
  const paused = state.items.filter((item) => item.status !== "active");
  // Phase 3: paydays + sale days on the timeline; "có thể chờ" only when stock lasts until the sale and the plan fits the budget.
  const horizon = addDays(today, 30);
  const sales = saleDays(today, horizon);
  const markers = [...paydays(recurring, today, horizon), ...sales];
  const overBudget = limit ? spent + planTotal(plan) > limit : false;
  const saleNotes: Record<string, string> = {};
  for (const estimate of estimates) { const sale = waitForSale(estimate, sales, today, overBudget); if (sale) saleNotes[estimate.item.id] = `còn đủ tới ${sale.label} (${Number(sale.on.slice(8))}/${Number(sale.on.slice(5, 7))}) — có thể chờ`; }
  const stages = upcomingStages(profile, state.plan, now);
  const benchmarks = estimates.map((estimate) => { const child = children.find((entry) => entry.id === estimate.item.childId) ?? children[0]; return benchmarkNote(estimate, child ? childAgeMonths(child, now) : undefined, child?.name ? `Bé ${child.name}` : "Bé"); }).filter((note): note is string => Boolean(note));

  return <div className="app-page shopping-plan">
    <div className="app-page-head"><div><h1>Mua sắm</h1><p className="app-sub">Nhà mình dùng gì · sắp cần mua gì · tháng này mua bao nhiêu</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}

    <button type="button" className="app-card inbox-hint" onClick={() => openInbox()}><span>Ghi lần mua… vd: 2 bịch Merries L 64 miếng 690k ở Shopee</span><b>＋ Ghi nhanh</b></button>

    <section className="app-section" aria-labelledby="sp-month"><h2 id="sp-month">Tháng này</h2>
      <div className="app-card money-kpis">
        <div className="brief-kpi"><small>Đã chi Con + Mua sắm</small><b>{money ? shortVnd(spent) : "—"}</b></div>
        <div className="brief-kpi"><small>Ngân sách hai nhóm</small><b>{limit ? shortVnd(limit) : "—"}</b></div>
        <div className="brief-kpi"><small>Lần mua đã ghi</small><b>{monthPurchases.length}</b></div>
        {limit ? <div className="money-plan"><span className="bar"><span className={spent > limit ? "over" : undefined} style={{ width: `${Math.min(100, Math.round(spent / limit * 100))}%` }} /></span><small>{spent > limit ? `Vượt ${shortVnd(spent - limit)}` : `Còn ${shortVnd(limit - spent)}`} · nguồn: sổ Tiền</small></div>
          : <div className="money-plan"><small>Chưa đặt ngân sách nhóm Con/Mua sắm. <Link className="brief-link" href="/money#month">Đặt ngân sách</Link> để FamAgent so kế hoạch mua với túi tiền.</small></div>}
      </div>
    </section>

    {unlinked.length > 0 && state.items.length > 0 && <section className="app-section" aria-labelledby="sp-reconcile"><h2 id="sp-reconcile">Khoản trong sổ chưa rõ mua gì</h2>
      <div className="brief-att">{unlinked.map((tx) => <ReconcileCard key={tx.id} tx={tx} items={state.items} purchases={state.purchases} familyChildren={children} onDone={() => void reload()} />)}</div>
    </section>}

    {state.items.length === 0 ? <StarterItems profile={profile} onAdd={async (items) => { for (const item of items) await saveItem(item); await reload(); }} /> : <>
      <UpcomingTimeline estimates={estimates} today={today} markers={markers} notes={saleNotes} actions={(estimate) => <>
        {estimate.item.productId && <Link className="app-btn ghost" href={`/agent?q=${encodeURIComponent(`Mua lại ${estimate.item.name}`)}`}>Tìm nơi mua</Link>}
        <MarkPurchased target={{ itemId: estimate.item.id, productId: estimate.item.productId, productName: estimate.item.name, brand: estimate.item.brand, merchant: estimate.item.merchant, price: estimate.lastPackPrice, piecesPerPack: estimate.item.packSize }} source="quick" label={estimate.lastPackPrice ? `Đã mua lại ~${shortVnd(estimate.lastPackPrice)}` : "Đã mua"} onDone={() => void reload()} />
      </>} />

      <div className="app-card app-rows account-rows push-invite"><PushToggle cloud={cloudEnabled} inviteOnly /></div>

      <MonthPlan lines={plan} month={monthKey(now)} items={state.items} familyChildren={children} budget={limit ? { spent, limit } : undefined} remainingOfPlan={money?.remainingOfPlan} notes={saleNotes} onChanged={() => void reload()} />

      <StageList stages={stages} month={monthKey(now)} onChanged={() => void reload()} />

      <section className="app-section" aria-labelledby="sp-items"><h2 id="sp-items">Đồ nhà mình dùng · {estimates.length}</h2>
        <div className="item-grid">{estimates.map((estimate) => <ItemCard key={estimate.item.id} estimate={estimate} familyChildren={children} purchases={state.purchases} onChanged={() => void reload()} onSave={saveItem} onRemove={(item) => deleteItem(item.id)} extra={estimate.rateSource !== "set" ? <details className="item-check"><summary>Còn không?</summary><StockCheck compact estimate={estimate} onDone={() => void reload()} /></details> : undefined} />)}</div>
        {paused.length > 0 && <p className="app-sub">Đang ngừng theo dõi: {paused.map((item) => <button key={item.id} type="button" className="ledger-link" onClick={() => void saveItem({ ...item, status: "active" }).then(reload)}>{item.name}</button>)}</p>}
      </section>
    </>}

    {state.purchases.length > 0 && <HabitsPanel purchases={state.purchases} items={state.items} notes={benchmarks} now={now} />}

    {state.purchases.length > 0 && <section className="app-section" aria-labelledby="sp-history"><details className="app-card history">
      <summary id="sp-history">Lịch sử mua · {state.purchases.length} lần</summary>
      <div className="app-rows">{state.purchases.slice(0, 60).map((purchase) => <div key={purchase.id}>
        <span><b>{purchase.productName}{purchase.packs > 1 ? ` ×${purchase.packs}` : ""}</b><small>{dayLabel(purchase.purchasedOn)}{purchase.merchant ? ` · ${purchase.merchant}` : ""} · {purchase.unitCount} {state.items.find((item) => item.id === purchase.itemId)?.unit ?? "đơn vị"}{purchase.transactionId ? " · đã ghi vào Tiền" : ""}</small></span>
        <span className="row-actions"><b>{vnd(purchase.amount)}</b><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm("Xóa lần mua này và khoản chi đã ghi vào Tiền?")) void deletePurchase(purchase.id).then(reload).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chưa xóa được.")); }}>Xóa</button></span>
      </div>)}</div>
    </details></section>}

    <p className="app-sub money-foot">Cần chọn sản phẩm mới? <Link className="brief-link" href="/shopping/find">Tìm & so sánh bỉm</Link> · <Link className="brief-link" href="/agent">Hỏi FamAgent</Link></p>
  </div>;
}
