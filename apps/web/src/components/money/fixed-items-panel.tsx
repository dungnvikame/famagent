"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { expectedAmount } from "@/lib/money/fixed-items";
import { todayLocal } from "@/lib/money/parse";
import { itemStatus, listedItems, scheduleText } from "@/lib/money/plan-model";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBundle, MoneyRecurring } from "@/lib/money/types";
import { FixedItemForm } from "./fixed-item-form";

interface Props {
  bundle: MoneyBundle; summary: MonthSummary; month: string;
  onRecurring: (item: MoneyRecurring) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
}

/** "Khoản cố định": every fixed item (income and expense, running or paused) with where it stands this month. */
export function FixedItemsPanel({ bundle, summary, month, onRecurring, onDeleteRecurring }: Props) {
  // "new", an item id (editing it in place), or nothing.
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const items = listedItems(bundle.recurring);
  const linked = new Set((bundle.settings.position?.debts ?? []).map((debt) => debt.recurringId).filter(Boolean));
  const today = todayLocal();
  const run = async (task: () => Promise<void>) => { try { setError(""); await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } };
  const save = async (item: MoneyRecurring) => { await onRecurring(item); setEditing(null); };
  const form = (existing?: MoneyRecurring) => <FixedItemForm existing={existing} month={month} categories={bundle.settings.categories} onSave={save} onCancel={() => setEditing(null)} />;

  return <section className="app-card pl-card" id="plan-fixed-items" aria-labelledby="pl-items-h">
    <h3 id="pl-items-h">Khoản cố định <small>{items.length} khoản</small></h3>
    <p className="pl-hint">Không tự ghi vào sổ. Tới kỳ, app nhắc “Đã trả?”: bạn xác nhận ngày và số tiền thật, hoặc bỏ qua kỳ đó.</p>
    {items.length === 0 && editing !== "new" && <p className="pl-empty">Chưa có khoản nào. Thêm lương, tiền nhà, điện nước, học phí… để app tự tính kế hoạch tháng.</p>}
    <ul className="pl-items">
      {items.map((item) => {
        if (editing === item.id) return <li key={item.id} className="pl-item-edit">{form(item)}</li>;
        const { amount, estimated } = expectedAmount(item, bundle.recurringAmounts);
        const status = itemStatus(item, month, bundle.periods ?? [], summary.due, today);
        return <li key={item.id} className={`pl-item${item.active ? "" : " off"}`}>
          <div className="pl-item-main"><b>{item.name}{estimated && <span className="pl-est">ước lượng</span>}</b><small>{scheduleText(item)} · {item.kind === "income" ? "Thu" : "Chi"}</small></div>
          <div className="pl-item-amt">{item.kind === "income" ? "+" : ""}{estimated ? "~" : ""}{vnd(amount)}</div>
          <span className={`pl-tag ${status.tone}`}>{status.label}</span>
          <div className="pl-item-acts">
            <button type="button" className="pl-link" aria-label={`Sửa ${item.name}`} onClick={() => { setError(""); setEditing(item.id); }}>Sửa</button>
            <button type="button" className="pl-link" aria-label={`${item.active ? "Tạm dừng" : "Bật lại"} ${item.name}`} onClick={() => void run(() => onRecurring({ ...item, active: !item.active }))}>{item.active ? "Tạm dừng" : "Bật lại"}</button>
            {linked.has(item.id) ? <span className="pl-linked">Từ khoản nợ</span>
              : <button type="button" className="pl-link danger" aria-label={`Xóa ${item.name}`} onClick={() => { if (window.confirm(`Xóa “${item.name}”?`)) void run(() => onDeleteRecurring(item.id)); }}>Xóa</button>}
          </div>
        </li>;
      })}
    </ul>
    {editing === "new" ? form() : <button type="button" className="app-btn ghost pl-btn pl-add" onClick={() => { setError(""); setEditing("new"); }}>＋ Thêm khoản cố định</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
