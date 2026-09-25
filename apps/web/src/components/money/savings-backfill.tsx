"use client";

import { useEffect, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { backfillPlan, parseMonthInput, type BackfillLine } from "@/lib/money/backfill";
import { loadRange, saveMoneyItem } from "@/lib/money/client";
import { formatVnDate, parseVnd } from "@/lib/money/parse";
import { monthKey, recurringFor } from "@/lib/money/summary";
import type { MoneyRecurring } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

/**
 * "Ghi bù": record a monthly saving transfer for past months in one go (e.g. 7.000.000đ on the 5th since 05/2025).
 * Months that already have a transfer of the same amount are skipped; optionally keep it going every month.
 */
export function SavingsBackfill({ recurring, onDone }: { recurring: MoneyRecurring[]; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("7.000.000");
  const [day, setDay] = useState("5");
  const [from, setFrom] = useState("05/2025");
  const [to, setTo] = useState(monthLabel(monthKey(new Date())));
  const [keep, setKeep] = useState(true);
  const [plan, setPlan] = useState<BackfillLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const value = parseVnd(amount); const dayNumber = Number(day); const start = parseMonthInput(from); const end = parseMonthInput(to);
  const valid = value !== null && value > 0 && Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31 && start && end && start <= end && end <= monthKey(new Date());
  const monthly = recurring.some((item) => item.active && item.kind === "saving" && item.amount === value);

  // Existing transfers in the range decide which months are skipped.
  useEffect(() => {
    if (!open || !valid) { setPlan(null); return; }
    let live = true;
    const [ey, em] = end!.split("-").map(Number);
    loadRange(`${start}-01`, `${end}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`)
      .then((range) => { if (live) setPlan(backfillPlan(value!, dayNumber, start!, end!, range.transactions)); })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Không tải được sổ."); });
    return () => { live = false; };
  }, [open, valid, value, dayNumber, start, end]);

  const lines = plan?.filter((line) => !line.skip) ?? [];

  async function save() {
    if (!lines.length || !value) return;
    setBusy(true); setError("");
    try {
      for (const line of lines) await saveMoneyItem("transactions", { id: crypto.randomUUID(), occurredOn: line.occurredOn, content: "Gửi tiết kiệm", category: "Tiết kiệm", kind: "saving", amount: value, forChild: false, source: "manual" });
      // Keep it going: a monthly item that counts the last backfilled month as posted.
      if (keep && !monthly) await saveMoneyItem("recurring", recurringFor({ content: "Gửi tiết kiệm", kind: "saving", category: "Tiết kiệm", amount: value, occurredOn: `${end}-01` }, dayNumber, crypto.randomUUID()));
      setDone(`✓ Đã ghi ${lines.length} khoản gửi tiết kiệm (${vnd(value * lines.length)}).`);
      setOpen(false); setPlan(null);
      await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được."); }
    finally { setBusy(false); }
  }

  if (!open) return <div className="backfill-cta"><span>Gửi tiết kiệm đều mỗi tháng từ trước?{done && <b className="done"> {done}</b>}</span><button type="button" className="app-btn ghost" onClick={() => { setOpen(true); setDone(""); }}>Ghi bù các tháng trước</button></div>;

  return <section className="app-card backfill">
    <div className="fw-panel-head"><div><b>Ghi bù khoản gửi tiết kiệm hằng tháng</b></div><button type="button" className="ledger-link" onClick={() => setOpen(false)}>Đóng</button></div>
    <div className="bf-form">
      <label>Số tiền<AmountInput aria-label="Số tiền mỗi tháng" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Ngày trong tháng<input type="number" min={1} max={31} value={day} onChange={(event) => setDay(event.target.value)} /></label>
      <label>Từ tháng<input placeholder="05/2025" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Đến tháng<input placeholder="09/2026" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    </div>
    {!valid && <p className="form-error">Nhập số tiền, ngày 1–31 và tháng dạng mm/yyyy (không quá tháng này).</p>}
    {plan && <div className="bf-list">{plan.map((line) => <div key={line.month} className={line.skip ? "skip" : undefined}><span>{formatVnDate(line.occurredOn)} · {line.skip ? "đã có trong sổ, bỏ qua" : "Gửi tiết kiệm"}</span><b>{line.skip ? "—" : vnd(value!)}</b></div>)}</div>}
    {!monthly && <label className="bf-keep"><input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} /> Tiếp tục hằng tháng (ngày {dayNumber || "…"})</label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="review-foot"><span><b>{lines.length} khoản</b>{value && lines.length ? ` · tổng ${vnd(value * lines.length)}` : ""}</span><span className="row-actions"><button type="button" className="app-btn ghost" onClick={() => setOpen(false)}>Hủy</button><button type="button" className="app-btn" disabled={busy || !lines.length} onClick={() => void save()}>{busy ? "Đang ghi…" : `Ghi ${lines.length} khoản`}</button></span></div>
  </section>;
}
