"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { formatVnDate, groupAmountTyping, parseVnd, todayLocal } from "@/lib/money/parse";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyCategory, type MoneyKind, type MoneyRecurring, type MoneyTransaction } from "@/lib/money/types";
import type { ChildProfile } from "@/lib/experience/types";
import { AmountInput } from "./amount-input";
import { DateInput } from "./date-input";

interface Props {
  transactions: MoneyTransaction[];
  categories: MoneyCategory[];
  familyChildren: ChildProfile[];
  month: string;
  /** Cash (tiền tiêu) after each entry, computed on the whole range so filtering never changes it. */
  balances: Map<string, number>;
  /** Hidden while filters hide some entries: the running balance would not add up with the rows shown. */
  showBalance?: boolean;
  /** Shown when filters hide every entry. */
  emptyText?: string;
  recurring: MoneyRecurring[];
  /** Recurring items owned by a debt (managed in Tình hình → Khoản nợ, not toggled here). */
  debtRecurringIds: Set<string>;
  /** Saves the entry; `repeat.on` also makes it (or keeps it) a monthly recurring item on `repeat.day`. */
  onSave: (item: MoneyTransaction, repeat: { on: boolean; day: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Draft = { occurredOn: string; content: string; category: string; kind: MoneyKind; amount: string; forChild: boolean; note: string; repeat: boolean; repeatDay: string };
const blank = (month: string): Draft => ({ occurredOn: todayLocal().startsWith(month) ? todayLocal() : `${month}-01`, content: "", category: "", kind: "expense", amount: "", forChild: false, note: "", repeat: false, repeatDay: "" });
const toDraft = (item: MoneyTransaction, rec?: MoneyRecurring): Draft => ({ occurredOn: item.occurredOn, content: item.content, category: item.category, kind: item.kind, amount: groupAmountTyping(String(item.amount)), forChild: item.forChild, note: item.note ?? "", repeat: Boolean(rec?.active), repeatDay: rec ? String(rec.dayOfMonth) : "" });
const dayOf = (iso: string) => String(Number(iso.slice(8, 10)) || 1);

/** Ledger like the household Excel: one row per entry; the top row is the quick-add form, any row edits in place. */
export function LedgerTable({ transactions, categories, familyChildren, month, balances, showBalance = true, emptyText, recurring, debtRecurringIds, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(blank(month));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [byAmount, setByAmount] = useState(false);
  const balanceAfter = balances;
  const rows = byAmount ? [...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) : transactions;
  const recurringOf = (item: MoneyTransaction) => item.recurringId ? recurring.find((rec) => rec.id === item.recurringId) : undefined;
  const options = (kind: MoneyKind) => kind === "saving" ? SAVING_CATEGORIES : categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);

  async function submit(existing?: MoneyTransaction) {
    const amount = parseVnd(draft.amount);
    if (!draft.content.trim()) { setError("Nhập nội dung khoản (ví dụ: Ăn sáng)."); return; }
    if (amount === null || (draft.kind !== "saving" && amount < 0)) { setError(draft.kind === "saving" ? "Số tiền không hợp lệ. Rút tiết kiệm thì nhập số âm, ví dụ -698k." : "Số tiền không hợp lệ. Ví dụ: 350k, 1,5tr hoặc 350000."); return; }
    const category = draft.category || options(draft.kind)[0] || "Khác";
    const day = Number(draft.repeatDay || dayOf(draft.occurredOn));
    if (draft.repeat && (amount <= 0 || !(Number.isInteger(day) && day >= 1 && day <= 31))) { setError(amount <= 0 ? "Khoản rút tiết kiệm không đặt lặp lại được." : "Ngày lặp lại cần từ 1 đến 31."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await onSave({ id: existing?.id ?? crypto.randomUUID(), occurredOn: draft.occurredOn, content: draft.content.trim(), category, kind: draft.kind, amount, forChild: draft.forChild, childId: draft.forChild ? familyChildren[0]?.id : undefined, note: draft.note.trim() || undefined, source: existing?.source ?? "manual", recurringId: existing?.recurringId }, { on: draft.repeat, day });
      const wasOn = existing ? Boolean(recurringOf(existing)?.active) : false;
      if (draft.repeat && !wasOn) setNotice(`✓ Đã đặt “${draft.content.trim()}” lặp lại ngày ${day} hằng tháng. Xem ở Tình hình → Thu & chi cố định.`);
      if (!draft.repeat && wasOn) setNotice(`Đã tắt lặp lại “${draft.content.trim()}”: các tháng sau không tự ghi nữa.`);
      setDraft(existing ? blank(month) : { ...blank(month), occurredOn: draft.occurredOn, kind: draft.kind }); setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }

  const fields = (existing?: MoneyTransaction) => <>
    <td data-label="Ngày"><DateInput aria-label="Ngày" value={draft.occurredOn} onChange={(occurredOn) => setDraft({ ...draft, occurredOn })} /></td>
    <td data-label="Nội dung"><input aria-label="Nội dung" placeholder="Ăn sáng, tiền điện…" value={draft.content} maxLength={120} autoFocus onChange={(event) => setDraft({ ...draft, content: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    <td data-label="Loại"><select aria-label="Loại" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MoneyKind, category: "" })}>{(Object.keys(MONEY_KIND_LABELS) as MoneyKind[]).map((kind) => <option key={kind} value={kind}>{MONEY_KIND_LABELS[kind]}</option>)}</select></td>
    <td data-label="Nhóm"><select aria-label="Nhóm" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">{options(draft.kind)[0] ?? "Khác"}</option>{options(draft.kind).slice(1).map((name) => <option key={name}>{name}</option>)}</select></td>
    <td data-label="Số tiền" colSpan={showBalance ? 2 : 1}><AmountInput aria-label="Số tiền" inputMode="decimal" placeholder={draft.kind === "saving" ? "5tr / -698k" : "350k"} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    <td className="ledger-child"><div className="ledger-options">
      <label><input type="checkbox" checked={draft.forChild} onChange={(event) => setDraft({ ...draft, forChild: event.target.checked })} /> <span>Cho con</span></label>
      {existing?.recurringId && debtRecurringIds.has(existing.recurringId) ? <small className="repeat-locked">↻ Từ khoản nợ</small>
        : <label className="repeat"><input type="checkbox" checked={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.checked, repeatDay: draft.repeatDay || dayOf(draft.occurredOn) })} /> <span>Hằng tháng</span></label>}
      {draft.repeat && <span className="repeat-day">ngày <input type="number" min={1} max={31} aria-label="Ngày lặp lại mỗi tháng" value={draft.repeatDay} onChange={(event) => setDraft({ ...draft, repeatDay: event.target.value })} /> mỗi tháng</span>}
    </div></td>
    <td className="ledger-actions"><button type="button" className="app-btn" disabled={busy} onClick={() => void submit(existing)}>{existing ? "Lưu" : "Thêm"}</button>{existing && <button type="button" className="ledger-link" onClick={() => { setEditing(null); setDraft(blank(month)); }}>Hủy</button>}</td>
  </>;

  return <div className="ledger-wrap">
    <table className="ledger" aria-label="Sổ thu chi">
      <thead><tr><th>Ngày</th><th>Nội dung</th><th>Loại</th><th>Nhóm</th><th className="num"><button type="button" className="th-sort" aria-pressed={byAmount} title={byAmount ? "Đang xếp theo số tiền · bấm để xếp theo ngày" : "Xếp theo số tiền, lớn nhất trước"} onClick={() => setByAmount(!byAmount)}>Số tiền {byAmount ? "▾" : "↕"}</button></th>{showBalance && <th className="num" title="Số dư tiền tiêu (tiền mặt + tài khoản) ngay sau khoản này">Số dư</th>}<th>Tùy chọn</th><th></th></tr></thead>
      <tbody>
        {!editing && <tr className="ledger-new">{fields()}</tr>}
        {rows.map((item) => editing === item.id ? <tr className="ledger-new" key={item.id}>{fields(item)}</tr> : <tr key={item.id} className={`ledger-row kind-${item.kind}`}>
          <td data-label="Ngày">{formatVnDate(item.occurredOn)}</td>
          <td data-label="Nội dung"><span className="ledger-content">{item.content}</span>{recurringOf(item)?.active ? <span className="rec-pill">↻ Hằng tháng · ngày {recurringOf(item)!.dayOfMonth}</span> : item.source === "recurring" && <span className="app-pill">Định kỳ</span>}{item.source === "purchase" && <span className="app-pill">Mua sắm</span>}{item.note && <small>{item.note}</small>}</td>
          <td data-label="Loại"><span className={`ledger-kind ${item.kind}`}>{MONEY_KIND_LABELS[item.kind]}</span></td>
          <td data-label="Nhóm">{item.category}</td>
          <td className="num" data-label="Số tiền">{item.kind === "expense" ? "−" : item.kind === "saving" && item.amount < 0 ? "+" : item.kind === "saving" ? "→" : "+"}{vnd(Math.abs(item.amount))}</td>
          {showBalance && <td className={`num ledger-balance${(balanceAfter.get(item.id) ?? 0) < 0 ? " negative" : ""}`} data-label="Số dư">{vnd(balanceAfter.get(item.id) ?? 0)}</td>}
          <td className="ledger-child" data-label="Cho con">{item.forChild ? "Cho con" : ""}</td>
          <td className="ledger-actions"><button type="button" className="ledger-link" onClick={() => { setEditing(item.id); setDraft(toDraft(item, recurringOf(item))); setError(""); setNotice(""); }}>Sửa</button><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa “${item.content}”?`)) void onDelete(item.id); }}>Xóa</button></td>
        </tr>)}
        {!transactions.length && <tr><td colSpan={showBalance ? 8 : 7} className="ledger-empty">{emptyText ?? "Chưa có khoản nào trong tháng này. Gõ vào dòng trên rồi Enter — như Excel."}</td></tr>}
      </tbody>
    </table>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="app-sub ledger-notice" role="status">{notice}</p>}
  </div>;
}
