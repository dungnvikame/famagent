"use client";

import { useId, useState } from "react";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import type { MoneyDebt } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

interface Props {
  /** Without a position (Tình hình) there is no date to anchor a debt to, so the form is not offered. */
  hasPosition: boolean;
  onAdd: (debt: MoneyDebt) => Promise<void>;
  onTab: (tab: "situ") => void;
}

const EMPTY = { name: "", balance: "", monthly: "", day: "", rate: "" };

/** Reads the optional numeric fields; returns the debt or the sentence that says what to fix. */
function readDebt(form: typeof EMPTY): MoneyDebt | string {
  const name = form.name.trim();
  if (!name) return "Nhập tên chủ nợ hoặc ngân hàng (ví dụ Thẻ Sacombank).";
  const balance = parseVnd(form.balance);
  if (balance === null || balance <= 0) return "Số còn nợ không hợp lệ (ví dụ 15tr).";
  const debt: MoneyDebt = { id: crypto.randomUUID(), name, balance, asOf: todayLocal() };
  if (form.monthly.trim()) {
    const monthly = parseVnd(form.monthly);
    if (monthly === null || monthly <= 0) return "Số trả mỗi tháng không hợp lệ (ví dụ 1,5tr).";
    debt.monthlyPayment = monthly;
    if (form.day.trim()) {
      const day = Number(form.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) return "Ngày trả phải từ 1 đến 31.";
      debt.dueDay = day;
    }
  }
  if (form.rate.trim()) {
    const rate = Number(form.rate.trim().replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return "Lãi phải từ 0 đến 100 %/năm.";
    if (rate > 0) debt.ratePct = rate;
  }
  return debt;
}

/** "＋ Thêm khoản nợ cũ": a debt the family already had, as it stands today. It writes nothing to the ledger. */
export function DebtAddForm({ hasPosition, onAdd, onTab }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof EMPTY>) => setForm({ ...form, ...patch });

  if (!hasPosition) return <section className="app-card debt-add">
    <p className="debt-add-note">Nhập số dư ở tab Tình hình trước, rồi thêm khoản nợ.</p>
    <button type="button" className="app-btn ghost debt-add-btn" onClick={() => onTab("situ")}>Nhập số dư ở Tình hình</button>
  </section>;

  async function save() {
    const debt = readDebt(form);
    if (typeof debt === "string") { setError(debt); return; }
    setBusy(true); setError("");
    try { await onAdd(debt); setForm(EMPTY); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được khoản nợ."); }
    finally { setBusy(false); }
  }

  if (!open) return <section className="app-card debt-add">
    <button type="button" className="app-btn ghost debt-add-btn" aria-expanded="false" aria-controls={`${uid}-form`} onClick={() => setOpen(true)}>＋ Thêm khoản nợ cũ</button>
  </section>;

  return <section className="app-card debt-add">
    <form id={`${uid}-form`} className="debt-add-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="debt-add-note wide">Đây là số còn nợ tính đến hôm nay — không ghi vào sổ thu chi, nên không làm sai số dư. Từ hôm nay, mỗi lần trả ghi vào sổ sẽ làm giảm khoản này.</p>
      <div className="f"><label htmlFor={`${uid}-name`}>Nợ ai / ngân hàng nào</label><input id={`${uid}-name`} value={form.name} maxLength={60} autoComplete="off" required placeholder="Thẻ Sacombank" onChange={(event) => set({ name: event.target.value })} /></div>
      <div className="f"><label htmlFor={`${uid}-balance`}>Còn nợ</label><AmountInput id={`${uid}-balance`} value={form.balance} required placeholder="15tr" onChange={(event) => set({ balance: event.target.value })} /></div>
      <div className="f"><label htmlFor={`${uid}-monthly`}>Trả mỗi tháng <small>(tuỳ chọn)</small></label><AmountInput id={`${uid}-monthly`} value={form.monthly} placeholder="1,5tr" onChange={(event) => set({ monthly: event.target.value })} /></div>
      {form.monthly.trim() && <div className="f"><label htmlFor={`${uid}-day`}>Ngày trả trong tháng <small>(tuỳ chọn)</small></label><input id={`${uid}-day`} value={form.day} inputMode="numeric" maxLength={2} autoComplete="off" placeholder="5" onChange={(event) => set({ day: event.target.value.replace(/\D/g, "") })} aria-describedby={`${uid}-day-help`} /><small id={`${uid}-day-help`}>Có ngày trả thì app nhắc “Đã trả?” mỗi tháng.</small></div>}
      <div className="f"><label htmlFor={`${uid}-rate`}>Lãi %/năm <small>(tuỳ chọn)</small></label><input id={`${uid}-rate`} value={form.rate} inputMode="decimal" autoComplete="off" placeholder="0" onChange={(event) => set({ rate: event.target.value })} /></div>
      {error && <p className="form-error wide" role="alert">{error}</p>}
      <div className="acts wide">
        <button type="button" className="app-btn ghost" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Hủy</button>
        <button type="submit" className="app-btn" disabled={busy}>{busy ? "Đang lưu…" : "Lưu khoản nợ"}</button>
      </div>
    </form>
  </section>;
}
