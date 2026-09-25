"use client";

import { useCallback, useEffect, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { loadLoans } from "@/lib/money/client";
import { debtOverview, loansByPerson, loanTotals, type PersonLedger } from "@/lib/money/loans";
import { formatVnDate, parseVnd, todayLocal } from "@/lib/money/parse";
import { debtLeft, monthsToPayOff } from "@/lib/money/position";
import type { MoneyBundle, MoneyTransaction } from "@/lib/money/types";
import { AmountInput } from "./amount-input";
import { DateInput } from "./date-input";

type Role = "lend" | "collect" | "borrow" | "repay";
const ROLES: Array<{ id: Role; label: string }> = [{ id: "lend", label: "Cho vay" }, { id: "collect", label: "Thu nợ về" }, { id: "borrow", label: "Vay vào" }, { id: "repay", label: "Trả nợ" }];
// Each role is one ledger line whose wording the Nợ tab can read back (personOf).
const LINE: Record<Role, { kind: "income" | "expense"; category: string; content: (name: string) => string }> = {
  lend: { kind: "expense", category: "Tiền cho vay", content: (name) => `Cho ${name} vay` },
  collect: { kind: "income", category: "Tiền trả nợ nhận về", content: (name) => `${name} trả` },
  borrow: { kind: "income", category: "Vay cá nhân", content: (name) => `Vay ${name}` },
  repay: { kind: "expense", category: "Tiền trả nợ", content: (name) => `Trả nợ ${name}` },
};

interface Props {
  bundle: MoneyBundle;
  /** Saves one ledger entry (the page reloads the month afterwards). */
  onSave: (item: MoneyTransaction) => Promise<void>;
  onTab: (tab: "situ") => void;
}

/**
 * Nợ: who owes the family and whom the family owes, per person, read from the ledger; big scheduled loans come
 * from Tình hình. Recording a loan here writes the same ledger line the Sổ would.
 */
export function DebtsView({ bundle, onSave, onTab }: Props) {
  const [loans, setLoans] = useState<MoneyTransaction[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState({ role: "lend" as Role, name: "", amount: "", date: todayLocal() });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => { try { setLoans(await loadLoans()); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được các khoản nợ."); } }, []);
  useEffect(() => { void refresh(); }, [refresh, bundle]);

  const debts = bundle.settings.position?.debts ?? [];
  const debtRecurring = new Set(debts.map((debt) => debt.recurringId).filter((id): id is string => Boolean(id)));
  const people = loansByPerson(loans ?? [], debtRecurring);
  const overview = debtOverview(loanTotals(loans ?? [], debtRecurring), debts, (debt) => debtLeft(debt, bundle.debtPaid));
  const lentOpen = people.lent.filter((row) => row.left > 0); const lentDone = people.lent.filter((row) => row.left <= 0);
  const oweOpen = people.owe.filter((row) => row.left > 0); const oweDone = people.owe.filter((row) => row.left <= 0);

  async function record() {
    const amount = parseVnd(form.amount);
    if (!form.name.trim()) { setError("Nhập tên người (ví dụ Tom, chị Hà)."); return; }
    if (amount === null || amount <= 0) { setError("Số tiền không hợp lệ (ví dụ 2tr)."); return; }
    const line = LINE[form.role];
    setBusy(true); setError("");
    try {
      await onSave({ id: crypto.randomUUID(), occurredOn: form.date, content: line.content(form.name.trim()), category: line.category, kind: line.kind, amount, forChild: false, source: "manual" });
      setForm({ ...form, amount: "" });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được."); }
    finally { setBusy(false); }
  }

  const prefill = (row: PersonLedger, role: Role) => { setForm({ role, name: row.name === "Khác" ? "" : row.name, amount: row.left > 0 ? row.left.toLocaleString("vi-VN") : "", date: todayLocal() }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const personRow = (row: PersonLedger, side: "lent" | "owe") => {
    const paid = side === "lent" ? row.received : row.given; const total = side === "lent" ? row.given : row.received;
    const key = `${side}:${row.key}`;
    return <div key={key} className="prow-wrap">
      <button type="button" className="prow" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
        <span><b>{row.name}</b><small>{side === "lent" ? "Cho vay" : "Vay"} {vnd(total)} · đã trả {vnd(paid)} · gần nhất {formatVnDate(row.last)}</small></span>
        <span className={`left ${side === "lent" ? "lend-c" : "owe-c"}`}>{row.left > 0 ? vnd(row.left) : "Đã trả hết"}</span>
        {total > 0 && <span className="pbar-s"><span style={{ width: `${Math.min(100, paid / total * 100)}%` }} /></span>}
      </button>
      {open === key && <div className="tl">
        {row.entries.map((tx) => <div key={tx.id}><span>{formatVnDate(tx.occurredOn)} · {tx.content}</span><b className={(side === "lent") === (tx.kind === "expense") ? "owe-c" : "lend-c"}>{tx.kind === "income" ? "+" : "−"}{vnd(tx.amount)}</b></div>)}
        {row.left > 0 && row.name !== "Khác" && <div className="tl-act"><button type="button" className="ledger-link" onClick={() => prefill(row, side === "lent" ? "collect" : "repay")}>{side === "lent" ? "Ghi khoản trả lại" : "Ghi khoản trả nợ"}</button></div>}
      </div>}
    </div>;
  };

  return <div className="debts">
    <div className="dk">
      <div className="owe"><small>Mình đang nợ</small><b>{vnd(overview.owed)}</b><em>{[debts.length ? `${debts.length} khoản vay lớn` : "", oweOpen.length ? `${oweOpen.length} người` : ""].filter(Boolean).join(" · ") || "không có"}</em></div>
      <div className="lend"><small>Người khác nợ mình</small><b>{vnd(overview.lent)}</b><em>{lentOpen.length ? `${lentOpen.length} người` : "không có"}</em></div>
      <div><small>Ròng</small><b className={overview.lent - overview.owed < 0 ? "owe-c" : "lend-c"}>{overview.lent - overview.owed < 0 ? "−" : ""}{vnd(Math.abs(overview.lent - overview.owed))}</b><em>cho vay − nợ</em></div>
    </div>

    <section className="app-card"><div className="qform">
      <select aria-label="Loại" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>{ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select>
      <input aria-label="Người" placeholder="Người (Tom, chị Hà…)" value={form.name} maxLength={40} onChange={(event) => setForm({ ...form, name: event.target.value })} list="debt-people" />
      <datalist id="debt-people">{[...people.lent, ...people.owe].filter((row) => row.name !== "Khác").map((row) => <option key={`${row.key}`} value={row.name} />)}</datalist>
      <AmountInput aria-label="Số tiền" placeholder="Số tiền" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void record(); }} />
      <DateInput aria-label="Ngày" value={form.date} onChange={(date) => setForm({ ...form, date })} />
      <button type="button" className="app-btn" disabled={busy} onClick={() => void record()}>{busy ? "Đang ghi…" : "Ghi"}</button>
    </div>{error && <p className="form-error" role="alert">{error}</p>}</section>

    {!loans ? <div className="app-card"><p className="app-sub">Đang tải các khoản nợ…</p></div> : <div className="dgrid">
      <section className="app-card dcard"><h3>Người khác nợ mình <small>{vnd(overview.lent)}</small></h3>
        {lentOpen.length ? lentOpen.map((row) => personRow(row, "lent")) : <p className="app-sub">Không ai đang nợ nhà mình.</p>}
        {lentDone.length > 0 && (showDone ? lentDone.map((row) => personRow(row, "lent")) : <button type="button" className="done-fold" onClick={() => setShowDone(true)}>Đã trả hết · {lentDone.length} người ({lentDone.slice(0, 3).map((row) => row.name).join(", ")}{lentDone.length > 3 ? "…" : ""})</button>)}
      </section>
      <section className="app-card dcard"><h3>Mình đang nợ <small>{vnd(overview.owed)}</small></h3>
        {oweOpen.map((row) => personRow(row, "owe"))}
        {debts.map((debt) => { const left = debtLeft(debt, bundle.debtPaid); const months = monthsToPayOff(left, debt.monthlyPayment, debt.ratePct); return <div key={debt.id} className="big-loan"><span><b>{debt.name}</b><small>Khoản vay lớn{debt.monthlyPayment ? ` · trả ${vnd(debt.monthlyPayment)} ngày ${debt.dueDay}` : ""}{months ? ` · còn khoảng ${months} tháng` : ""} · <button type="button" className="ledger-link" onClick={() => onTab("situ")}>sửa ở Tình hình</button></small></span><b className="owe-c">{vnd(left)}</b></div>; })}
        {!oweOpen.length && !debts.length && <p className="app-sub">Nhà mình không nợ ai.</p>}
        {oweDone.length > 0 && showDone && oweDone.map((row) => personRow(row, "owe"))}
      </section>
    </div>}
  </div>;
}
