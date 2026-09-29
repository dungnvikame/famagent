"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { vnd } from "@/lib/catalog/format";
import type { DueEntry } from "@/lib/money/fixed-items";
import { vndCompact } from "@/lib/money/format-vnd";
import { groupAmountTyping, parseVnd, todayLocal } from "@/lib/money/parse";
import { AmountInput } from "./amount-input";
import { DateInput } from "./date-input";

interface Props {
  entry: DueEntry;
  /** Last paid amounts of this item (newest first), shown so an estimate can be checked. */
  history?: number[];
  /** The debt this payment goes toward, with what is left before this payment. */
  debt?: { name: string; left: number } | null;
  onConfirm: (input: { occurredOn: string; amount: number }) => Promise<void>;
  onSkip: () => Promise<void>;
  onClose: () => void;
}

/** "Đã trả?" — the real date and amount of a fixed item's period, or skip it. Opens from the due strip. */
export function PayDialog({ entry, history, debt, onConfirm, onSkip, onClose }: Props) {
  const income = entry.kind === "income";
  const [date, setDate] = useState(todayLocal());
  const [amount, setAmount] = useState(groupAmountTyping(String(entry.amount)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => document.getElementById("pd-amount")?.focus({ preventScroll: true }), 120); return () => clearTimeout(t); }, []);

  const value = parseVnd(amount);
  const average = history?.length ? Math.round(history.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, history.length)) : null;

  async function run(task: () => Promise<void>) {
    setBusy(true); setError("");
    try { await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); setBusy(false); }
  }
  function trap(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type=hidden]):not([tabindex='-1'])")].filter((el) => el.offsetParent !== null);
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <>
    <div className="pd-scrim" onClick={onClose} aria-hidden="true" />
    <div ref={panel} className="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title" onKeyDown={trap}>
      <h2 id="pd-title">{entry.name} · {entry.label}</h2>
      <p className="pd-hint">
        {history?.length ? <>Các kỳ trước: {history.slice(0, 3).map(vndCompact).join(" · ")}{average ? ` (trung bình ${vndCompact(average)})` : ""}</> : <>Số tiền {entry.estimated ? "ước lượng" : "cố định"} {vndCompact(entry.amount)}</>}
      </p>
      <div className="pd-two">
        <div className="pd-field"><span className="pd-label">Ngày</span><DateInput aria-label="Ngày" value={date} onChange={setDate} /></div>
        <div className="pd-field"><label htmlFor="pd-amount">Số tiền thật</label>
          <AmountInput id="pd-amount" value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && value) void run(() => onConfirm({ occurredOn: date, amount: value })); }} /></div>
      </div>
      {debt && !income && <p className="pd-note">Trừ vào khoản nợ <b>{debt.name}</b>: còn {vndCompact(debt.left)} → <b>{value ? vndCompact(Math.max(0, debt.left - value)) : "…"}</b> (chưa tính lãi kỳ này)</p>}
      {value !== null && value > 0 && entry.estimated && average && Math.abs(value - average) > average * 0.3 && <p className="pd-note warn">Khác nhiều so với trung bình {vnd(average)} — kiểm tra lại số tiền.</p>}
      {error && <p className="pd-error" role="alert">{error}</p>}
      <div className="pd-actions">
        <button type="button" className="pd-btn primary" disabled={busy || !value || value <= 0} onClick={() => value && void run(() => onConfirm({ occurredOn: date, amount: value }))}>{busy ? "Đang ghi…" : income ? "Ghi đã nhận" : "Ghi vào sổ"}</button>
        <button type="button" className="pd-btn" disabled={busy} onClick={() => void run(onSkip)}>Bỏ qua kỳ này</button>
        <button type="button" className="pd-btn" disabled={busy} onClick={onClose}>Để sau</button>
      </div>
    </div>
  </>;
}
