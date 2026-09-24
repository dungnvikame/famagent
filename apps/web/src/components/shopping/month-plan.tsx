"use client";

import { useState } from "react";
import type { ChildProfile } from "@/lib/experience/types";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { shortVnd } from "@/lib/money/summary";
import { savePlanEntry } from "@/lib/shopping/item-client";
import type { ShoppingItem } from "@/lib/shopping/items";
import { entryFor, planTotal, shiftMonth, type PlanLine } from "@/lib/shopping/plan";
import { budgetHint } from "@/lib/shopping/purchases";
import { PurchaseDraftCard } from "./purchase-draft-card";

const REASON: Record<PlanLine["reason"], string> = { running_low: "sắp hết", stage: "theo giai đoạn của bé", manual: "bạn thêm", sale: "chờ ngày sale" };
const dayLabel = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

/** "Kế hoạch tháng": what to buy before the month ends, its cost against the budget, and one-tap bought/skip/next month. */
export function MonthPlan({ lines, month, items, familyChildren, budget, remainingOfPlan, notes, onChanged }: {
  lines: PlanLine[]; month: string; items: ShoppingItem[]; familyChildren: ChildProfile[];
  budget?: { spent: number; limit?: number }; remainingOfPlan?: number; notes?: Record<string, string>; onChanged: () => void;
}) {
  const [buying, setBuying] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const total = planTotal(lines);
  const hint = total ? budgetHint(total, budget, remainingOfPlan, "Con + Mua sắm") : null;

  async function update(line: PlanLine, patch: Parameters<typeof entryFor>[2]) {
    try { await savePlanEntry(entryFor(line, month, patch)); setError(""); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  async function moveNext(line: PlanLine) {
    try { await savePlanEntry(entryFor(line, shiftMonth(month, 1), { status: "planned" }, crypto.randomUUID())); await update(line, { status: "skipped" }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  async function add() {
    const value = amount.trim() ? parseVnd(amount) : undefined;
    if (!name.trim()) { setError("Nhập tên món cần mua."); return; }
    if (value === null) { setError("Số tiền dự kiến chưa đúng (ví dụ 300k)."); return; }
    const match = items.find((item) => item.name.toLocaleLowerCase("vi") === name.trim().toLocaleLowerCase("vi"));
    try { await savePlanEntry({ id: crypto.randomUUID(), month, itemId: match?.id, name: name.trim(), packs: 1, estAmount: value, reason: "manual", status: "planned" }); setName(""); setAmount(""); setAdding(false); setError(""); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }

  return <section className="app-section" aria-labelledby="plan-title">
    <h2 id="plan-title">Kế hoạch tháng {Number(month.slice(5))}</h2>
    <div className="app-card month-plan">
      {lines.length ? <div className="app-rows">{lines.map((line) => {
        const item = items.find((entry) => entry.id === line.itemId);
        return <div key={line.key} className={`plan-line ${line.status}`}>
          <span><b>{line.packs > 1 ? `${line.packs} × ` : ""}{line.name}</b><small>{REASON[line.reason]}{line.dueOn ? ` · hết khoảng ${dayLabel(line.dueOn)}` : ""}{line.status === "bought" ? " · đã mua" : line.status === "skipped" ? " · bỏ qua" : ""}{notes?.[line.key] ? ` · ${notes[line.key]}` : ""}</small></span>
          <span className="row-actions">
            {line.estAmount ? <b>{shortVnd(line.estAmount)}</b> : null}
            {line.status === "planned" ? <>
              <button type="button" className="ledger-link" onClick={() => setBuying(buying === line.key ? null : line.key)}>Đã mua</button>
              <button type="button" className="ledger-link" onClick={() => void moveNext(line)}>Tháng sau</button>
              <button type="button" className="ledger-link" onClick={() => void update(line, { status: "skipped" })}>Bỏ qua</button>
            </> : <button type="button" className="ledger-link" onClick={() => void update(line, { status: "planned" })}>Hoàn tác</button>}
          </span>
          {buying === line.key && <PurchaseDraftCard draft={{ itemId: item?.id, name: item?.name ?? line.name, category: item?.category ?? "other", unit: item?.unit ?? "gói", packs: line.packs, packSize: item?.packSize, amount: line.estAmount, merchant: item?.merchant, purchasedOn: todayLocal(), missing: [] }} items={items} familyChildren={familyChildren} source="plan" title={`Ghi lần mua ${line.name}`} onCancel={() => setBuying(null)} onSaved={() => { setBuying(null); void update(line, { status: "bought" }); }} />}
        </div>;
      })}</div> : <p className="app-sub" style={{ margin: 0 }}>Chưa có món nào cần mua trước cuối tháng. FamAgent sẽ đề xuất khi một món sắp hết.</p>}
      <p className="plan-total"><b>Còn cần mua: {total ? shortVnd(total) : "—"}</b>{hint && <small>{hint}</small>}</p>
      {adding ? <form className="plan-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ghế ăn dặm" aria-label="Món cần mua" autoFocus />
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Dự kiến 500k" aria-label="Số tiền dự kiến" inputMode="decimal" />
        <button type="submit" className="app-btn">Thêm</button><button type="button" className="ledger-link" onClick={() => setAdding(false)}>Hủy</button>
      </form> : <button type="button" className="ledger-link" onClick={() => setAdding(true)}>+ Thêm món vào kế hoạch</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
