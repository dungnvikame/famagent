"use client";

import { useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { buildEntry } from "@/lib/money/entry";
import { formatVnDate, groupAmountTyping, todayLocal } from "@/lib/money/parse";
import type { PotBalance } from "@/lib/money/history";
import { guessEntry, type QuickContext } from "@/lib/money/quick-add";
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
  balances: Map<string, PotBalance>;
  /** Hidden while filters hide some entries: the running balance would not add up with the rows shown. */
  showBalance?: boolean;
  /** "Chi tiết số dư": the savings and account balance after each entry (off by default, the table stays compact). */
  balanceOpen: boolean;
  onBalanceOpen: (open: boolean) => void;
  /** Shown when filters hide every entry. */
  emptyText?: string;
  recurring: MoneyRecurring[];
  /** Recurring items owned by a debt (managed in Tình hình → Khoản nợ, not toggled here). */
  debtRecurringIds: Set<string>;
  /** Saves the entry; `repeat.on` also makes it (or keeps it) a monthly recurring item on `repeat.day`. */
  onSave: (item: MoneyTransaction, repeat: { on: boolean; day: number }) => Promise<{ answered: string | null } | void>;
  onDelete: (id: string) => Promise<void>;
  /** Categories, memory and the whole ledger: the add row guesses the category from the content as it is typed. */
  guessContext?: Omit<QuickContext, "today">;
}

/** `picked`: the family chose the category (or is editing a saved entry), so typing never overrides it. `unsure`: weak guess, highlighted. */
type Draft = { occurredOn: string; content: string; category: string; kind: MoneyKind; amount: string; forChild: boolean; note: string; repeat: boolean; repeatDay: string; fromSavings: boolean; picked: boolean; unsure: boolean };
const blank = (month: string): Draft => ({ occurredOn: todayLocal().startsWith(month) ? todayLocal() : `${month}-01`, content: "", category: "", kind: "expense", amount: "", forChild: false, note: "", repeat: false, repeatDay: "", fromSavings: false, picked: false, unsure: false });
const toDraft = (item: MoneyTransaction, rec?: MoneyRecurring): Draft => ({ occurredOn: item.occurredOn, content: item.content, category: item.category, kind: item.kind, amount: groupAmountTyping(String(item.amount)), forChild: item.forChild, note: item.note ?? "", repeat: Boolean(rec?.active), repeatDay: rec ? String(rec.dayOfMonth) : "", fromSavings: item.paidFrom === "savings", picked: true, unsure: false });
const dayOf = (iso: string) => String(Number(iso.slice(8, 10)) || 1);
const KIND_MARK: Record<MoneyKind, string> = { expense: "−", income: "+", saving: "→" };
const amountText = (item: MoneyTransaction) => `${item.kind === "saving" && item.amount < 0 ? "+" : KIND_MARK[item.kind]}${vnd(Math.abs(item.amount))}`;

/** Ledger like the household Excel: one row per entry; the top row adds an entry (Enter saves), any row edits in place. */
export function LedgerTable({ transactions, categories, familyChildren, month, balances, showBalance = true, balanceOpen, onBalanceOpen, emptyText, recurring, debtRecurringIds, onSave, onDelete, guessContext }: Props) {
  const [draft, setDraft] = useState<Draft>(blank(month));
  const [editing, setEditing] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [byAmount, setByAmount] = useState(false);
  const balanceAfter = balances;
  const withBalance = showBalance && balanceOpen;
  const rows = byAmount ? [...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) : transactions;
  // The source the family used last time for this category (e.g. Bảo hiểm nhân thọ → Tiết kiệm).
  const lastFromSavings = (category: string, kind: MoneyKind) => kind === "expense" && transactions.find((tx) => tx.kind === "expense" && tx.category === (category || options(kind)[0]))?.paidFrom === "savings";
  const recurringOf = (item: MoneyTransaction) => item.recurringId ? recurring.find((rec) => rec.id === item.recurringId) : undefined;
  const options = (kind: MoneyKind) => kind === "saving" ? SAVING_CATEGORIES : categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  // Same rules as quick add (memory → earlier entries → own categories → keywords); savings are left to the family.
  const withGuess = (next: Draft): Draft => {
    if (next.kind === "saving" || !guessContext) return next;
    // Clearing the content starts a new entry: an earlier manual pick no longer applies.
    if (!next.content.trim()) return { ...next, category: "", picked: false, unsure: false, forChild: false };
    if (next.picked) return next;
    const hit = guessEntry(next.content, next.kind, { ...guessContext, today: todayLocal() });
    return { ...next, category: hit.category, unsure: hit.unsure, forChild: hit.forChild, fromSavings: hit.category === next.category ? next.fromSavings : lastFromSavings(hit.category, next.kind) };
  };

  async function submit(existing?: MoneyTransaction) {
    const built = buildEntry({
      content: draft.content, amountText: draft.amount, kind: draft.kind, category: draft.category || options(draft.kind)[0] || "Khác", occurredOn: draft.occurredOn,
      fromSavings: draft.fromSavings, forChild: draft.forChild, childId: existing?.childId ?? (familyChildren.length === 1 ? familyChildren[0].id : undefined), note: draft.note, existing,
    });
    if ("error" in built) { setError(built.error); return; }
    const day = Number(draft.repeatDay || dayOf(draft.occurredOn));
    if (draft.repeat && (built.entry.amount <= 0 || !(Number.isInteger(day) && day >= 1 && day <= 31))) { setError(built.entry.amount <= 0 ? "Khoản rút tiết kiệm không đặt lặp lại được." : "Ngày lặp lại cần từ 1 đến 31."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await onSave(built.entry, { on: draft.repeat, day });
      if (saved && saved.answered) setNotice(`✓ Khớp khoản cố định “${saved.answered}” — đã đánh dấu ${built.entry.kind === "income" ? "Đã nhận" : "Đã trả"}, không tạo trùng.`);
      const name = built.entry.content;
      const wasOn = existing ? Boolean(recurringOf(existing)?.active) : false;
      if (draft.repeat && !wasOn) setNotice(`✓ Đã đặt “${name}” lặp lại ngày ${day} hằng tháng. Xem ở Tình hình → Thu & chi cố định.`);
      if (!draft.repeat && wasOn) setNotice(`Đã tắt lặp lại “${name}”: các tháng sau không tự ghi nữa.`);
      setDraft(existing ? blank(month) : { ...blank(month), occurredOn: draft.occurredOn, kind: draft.kind }); setEditing(null); setDetailsOpen(false); setMenuFor(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }

  const cancel = () => { setEditing(null); setDraft(blank(month)); setDetailsOpen(false); };
  const fields = (existing?: MoneyTransaction) => <>
    <td className="lt-date" data-label="Ngày"><DateInput aria-label="Ngày" value={draft.occurredOn} onChange={(occurredOn) => setDraft({ ...draft, occurredOn })} /></td>
    <td className="lt-type" data-label="Loại"><select aria-label="Loại" value={draft.kind} onChange={(event) => setDraft(withGuess({ ...draft, kind: event.target.value as MoneyKind, category: "", picked: false, unsure: false }))}>{(Object.keys(MONEY_KIND_LABELS) as MoneyKind[]).map((kind) => <option key={kind} value={kind}>{kind === "saving" ? "TK" : MONEY_KIND_LABELS[kind]}</option>)}</select></td>
    <td className="lt-content" data-label="Nội dung"><input aria-label="Nội dung" placeholder="Ăn sáng, tiền điện…" value={draft.content} maxLength={120} autoFocus={Boolean(existing)} onChange={(event) => setDraft(withGuess({ ...draft, content: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    <td className="lt-cat" data-label="Nhóm"><select aria-label="Nhóm" className={draft.unsure && !draft.picked ? "unsure" : undefined} title={draft.unsure && !draft.picked ? "Chưa chắc nhóm này — kiểm tra lại" : undefined} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value, picked: true, unsure: false, fromSavings: lastFromSavings(event.target.value, draft.kind) })}><option value="">{options(draft.kind)[0] ?? "Khác"}</option>{options(draft.kind).slice(1).map((name) => <option key={name}>{name}</option>)}</select></td>
    <td className="lt-amount" data-label="Số tiền"><AmountInput aria-label="Số tiền" inputMode="decimal" placeholder={draft.kind === "saving" ? "5tr / -698k" : "350k"} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void submit(existing); }} /></td>
    {withBalance && <><td className="lt-bal" /><td className="lt-bal" /></>}
    <td className="lt-actions">
      <button type="button" className="lt-save" disabled={busy} onClick={() => void submit(existing)}>{existing ? "Lưu" : "Thêm ⏎"}</button>
      <button type="button" className="lt-more-btn" aria-expanded={detailsOpen} aria-label="Chi tiết: trả từ, hằng tháng" title="Chi tiết: trả từ, hằng tháng" onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? "▴" : "⋯"}</button>
      {existing && <button type="button" className="lt-link" onClick={cancel}>Hủy</button>}
    </td>
  </>;
  const details = (existing?: MoneyTransaction) => detailsOpen && <tr className="lt-details"><td colSpan={withBalance ? 8 : 6}>
    {draft.kind === "expense" && <div className="paid-from" role="group" aria-label="Trả từ"><span>Trả từ</span><button type="button" className={!draft.fromSavings ? "on" : undefined} onClick={() => setDraft({ ...draft, fromSavings: false })}>Tiền tiêu</button><button type="button" className={draft.fromSavings ? "on" : undefined} onClick={() => setDraft({ ...draft, fromSavings: true })}>Tiết kiệm</button></div>}
    {existing?.recurringId && debtRecurringIds.has(existing.recurringId) ? <small className="repeat-locked">↻ Từ khoản nợ</small>
      : <label className="repeat"><input type="checkbox" checked={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.checked, repeatDay: draft.repeatDay || dayOf(draft.occurredOn) })} /> <span>Hằng tháng</span></label>}
    {draft.repeat && <span className="repeat-day">ngày <input type="number" min={1} max={31} aria-label="Ngày lặp lại mỗi tháng" value={draft.repeatDay} onChange={(event) => setDraft({ ...draft, repeatDay: event.target.value })} /> mỗi tháng</span>}
  </td></tr>;

  const colCount = 6 + (withBalance ? 2 : 0);
  return <div className="lt">
    <div className="lt-tools">
      {showBalance && <button type="button" className={`lt-toggle${balanceOpen ? " on" : ""}`} aria-pressed={balanceOpen} onClick={() => onBalanceOpen(!balanceOpen)}><i aria-hidden="true" />Chi tiết số dư</button>}
    </div>
    <div className="lt-wrap">
      <table className={`lt-table${withBalance ? " wide" : ""}`} aria-label="Sổ thu chi">
        <thead><tr>
          <th className="lt-date">Ngày</th><th className="lt-type">Loại</th><th className="lt-content">Nội dung</th><th className="lt-cat">Nhóm</th>
          <th className="num lt-amount"><button type="button" className="th-sort" aria-pressed={byAmount} title={byAmount ? "Đang xếp theo số tiền · bấm để xếp theo ngày" : "Xếp theo số tiền, lớn nhất trước"} onClick={() => setByAmount(!byAmount)}>Số tiền {byAmount ? "▾" : "↕"}</button></th>
          {withBalance && <><th className="num lt-bal" title="Quỹ tiết kiệm sau khoản này">Tiết kiệm</th><th className="num lt-bal" title="Tiết kiệm + tiền tiêu sau khoản này (âm = đang dùng quá tiền tiêu)">Số dư</th></>}
          <th className="lt-actions"><span className="sr-only">Thao tác</span></th>
        </tr></thead>
        <tbody>
          {!editing && <><tr className="lt-add">{fields()}</tr>{details()}</>}
          {rows.map((item) => editing === item.id ? <>
            <tr className="lt-edit" key={item.id}>{fields(item)}</tr>{details(item)}
          </> : <tr key={item.id} className={`lt-row kind-${item.kind}`}>
            <td className="lt-date" data-label="Ngày">{formatVnDate(item.occurredOn)}</td>
            <td className="lt-type" data-label="Loại"><span className={`lt-kind ${item.kind}`} role="img" aria-label={MONEY_KIND_LABELS[item.kind]}>{KIND_MARK[item.kind]}</span></td>
            <td className="lt-content" data-label="Nội dung"><span className="ledger-content">{item.content}</span>{item.paidFrom === "savings" && <span className="src-pill">từ tiết kiệm</span>}{recurringOf(item)?.active ? <span className="rec-pill">↻ Hằng tháng · ngày {recurringOf(item)!.dayOfMonth}</span> : item.source === "recurring" && <span className="app-pill">Định kỳ</span>}{item.source === "purchase" && <span className="app-pill">Mua sắm</span>}{item.note && <small>{item.note}</small>}</td>
            <td className="lt-cat" data-label="Nhóm"><span className="lt-catchip">{item.category}</span></td>
            <td className={`num lt-amount ${item.kind}`} data-label="Số tiền">{amountText(item)}</td>
            {withBalance && (() => { const pot = balanceAfter.get(item.id); return <>
              <td className="num lt-bal" data-label="Tiết kiệm">{pot ? vnd(pot.savings) : ""}</td>
              <td className={`num lt-bal${pot && pot.account < 0 ? " negative" : ""}`} data-label="Số dư">{pot ? vnd(pot.account) : ""}</td>
            </>; })()}
            <td className="lt-actions">
              <button type="button" className="lt-menu" aria-expanded={menuFor === item.id} aria-label={`Thao tác cho ${item.content}`} onClick={() => setMenuFor(menuFor === item.id ? null : item.id)}>⋯</button>
              <span className={`lt-buttons${menuFor === item.id ? " open" : ""}`}>
                <button type="button" className="lt-link" onClick={() => { setEditing(item.id); setDraft(toDraft(item, recurringOf(item))); setDetailsOpen(Boolean(recurringOf(item)) || item.paidFrom === "savings"); setError(""); setNotice(""); }}>Sửa</button>
                <button type="button" className="lt-link danger" onClick={() => { if (window.confirm(`Xóa “${item.content}”?`)) void onDelete(item.id); }}>Xóa</button>
              </span>
            </td>
          </tr>)}
          {!transactions.length && <tr className="lt-empty-row"><td colSpan={colCount} className="ledger-empty">{emptyText ?? "Chưa có khoản nào trong tháng này. Bấm “＋ Ghi khoản” hoặc gõ vào dòng trên rồi Enter."}</td></tr>}
        </tbody>
      </table>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="app-sub ledger-notice" role="status">{notice}</p>}
  </div>;
}
