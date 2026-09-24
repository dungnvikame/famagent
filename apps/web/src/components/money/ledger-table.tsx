"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyCategory, type MoneyKind, type MoneyTransaction } from "@/lib/money/types";
import type { ChildProfile } from "@/lib/experience/types";

interface Props {
  transactions: MoneyTransaction[];
  categories: MoneyCategory[];
  familyChildren: ChildProfile[];
  month: string;
  onSave: (item: MoneyTransaction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Draft = { occurredOn: string; content: string; category: string; kind: MoneyKind; amount: string; forChild: boolean; note: string };
const blank = (month: string): Draft => ({ occurredOn: todayLocal().startsWith(month) ? todayLocal() : `${month}-01`, content: "", category: "", kind: "expense", amount: "", forChild: false, note: "" });
const toDraft = (item: MoneyTransaction): Draft => ({ occurredOn: item.occurredOn, content: item.content, category: item.category, kind: item.kind, amount: String(item.amount), forChild: item.forChild, note: item.note ?? "" });
const dayLabel = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

/** Ledger like the household Excel: one row per entry; the top row is the quick-add form, any row edits in place. */
export function LedgerTable({ transactions, categories, familyChildren, month, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(blank(month));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const options = (kind: MoneyKind) => kind === "saving" ? SAVING_CATEGORIES : categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);

  async function submit(existing?: MoneyTransaction) {
    const amount = parseVnd(draft.amount);
    if (!draft.content.trim()) { setError("Nhập nội dung khoản (ví dụ: Ăn sáng)."); return; }
    if (amount === null || (draft.kind !== "saving" && amount < 0)) { setError(draft.kind === "saving" ? "Số tiền không hợp lệ. Rút tiết kiệm thì nhập số âm, ví dụ -698k." : "Số tiền không hợp lệ. Ví dụ: 350k, 1,5tr hoặc 350000."); return; }
    const category = draft.category || options(draft.kind)[0] || "Khác";
    setBusy(true); setError("");
    try {
      await onSave({ id: existing?.id ?? crypto.randomUUID(), occurredOn: draft.occurredOn, content: draft.content.trim(), category, kind: draft.kind, amount, forChild: draft.forChild, childId: draft.forChild ? familyChildren[0]?.id : undefined, note: draft.note.trim() || undefined, source: existing?.source ?? "manual", recurringId: existing?.recurringId });
      setDraft(existing ? blank(month) : { ...blank(month), occurredOn: draft.occurredOn, kind: draft.kind }); setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }

  const fields = (existing?: MoneyTransaction) => <>
    <td><input type="date" aria-label="Ngày" value={draft.occurredOn} onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })} /></td>
    <td><input aria-label="Nội dung" placeholder="Ăn sáng, tiền điện…" value={draft.content} maxLength={120} autoFocus onChange={(event) => setDraft({ ...draft, content: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    <td><select aria-label="Loại" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MoneyKind, category: "" })}>{(Object.keys(MONEY_KIND_LABELS) as MoneyKind[]).map((kind) => <option key={kind} value={kind}>{MONEY_KIND_LABELS[kind]}</option>)}</select></td>
    <td><select aria-label="Nhóm" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">{options(draft.kind)[0] ?? "Khác"}</option>{options(draft.kind).slice(1).map((name) => <option key={name}>{name}</option>)}</select></td>
    <td><input aria-label="Số tiền" inputMode="decimal" placeholder={draft.kind === "saving" ? "5tr / -698k" : "350k"} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    <td className="ledger-child"><label><input type="checkbox" checked={draft.forChild} onChange={(event) => setDraft({ ...draft, forChild: event.target.checked })} /> <span>Cho con</span></label></td>
    <td className="ledger-actions"><button type="button" className="app-btn" disabled={busy} onClick={() => void submit(existing)}>{existing ? "Lưu" : "Thêm"}</button>{existing && <button type="button" className="ledger-link" onClick={() => { setEditing(null); setDraft(blank(month)); }}>Hủy</button>}</td>
  </>;

  return <div className="ledger-wrap">
    <table className="ledger" aria-label="Sổ thu chi">
      <thead><tr><th>Ngày</th><th>Nội dung</th><th>Loại</th><th>Nhóm</th><th className="num">Số tiền</th><th>Cho con</th><th></th></tr></thead>
      <tbody>
        {!editing && <tr className="ledger-new">{fields()}</tr>}
        {transactions.map((item) => editing === item.id ? <tr className="ledger-new" key={item.id}>{fields(item)}</tr> : <tr key={item.id} className={`ledger-row kind-${item.kind}`}>
          <td>{dayLabel(item.occurredOn)}</td>
          <td><span className="ledger-content">{item.content}</span>{item.source === "recurring" && <span className="app-pill">Định kỳ</span>}{item.source === "purchase" && <span className="app-pill">Mua sắm</span>}{item.note && <small>{item.note}</small>}</td>
          <td><span className={`ledger-kind ${item.kind}`}>{MONEY_KIND_LABELS[item.kind]}</span></td>
          <td>{item.category}</td>
          <td className="num">{item.kind === "expense" ? "−" : item.kind === "saving" && item.amount < 0 ? "+" : item.kind === "saving" ? "→" : "+"}{vnd(Math.abs(item.amount))}</td>
          <td className="ledger-child">{item.forChild ? "✓" : ""}</td>
          <td className="ledger-actions"><button type="button" className="ledger-link" onClick={() => { setEditing(item.id); setDraft(toDraft(item)); setError(""); }}>Sửa</button><button type="button" className="ledger-link danger" onClick={() => { if (window.confirm(`Xóa “${item.content}”?`)) void onDelete(item.id); }}>Xóa</button></td>
        </tr>)}
        {!transactions.length && <tr><td colSpan={7} className="ledger-empty">Chưa có khoản nào trong tháng này. Gõ vào dòng trên rồi Enter — như Excel.</td></tr>}
      </tbody>
    </table>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
