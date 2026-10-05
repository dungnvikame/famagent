"use client";

import { useEffect, useId, useRef, useState } from "react";
import { todayLocal } from "@/lib/money/parse";
import { doneWord, emptyForm, formFromItem, isDone, monthWindow, previewText, readForm, SCHEDULE_KINDS, type RecurringForm } from "@/lib/money/recurring-form";
import { SAVING_CATEGORIES, type MoneyCategory, type MoneyRecurring } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

interface Props {
  /** The item being edited; without it the form makes a new one. */
  existing?: MoneyRecurring;
  month: string; categories: MoneyCategory[];
  onSave: (item: MoneyRecurring) => Promise<void>;
  onCancel: () => void;
}

const categoryNames = (categories: MoneyCategory[], kind: RecurringForm["kind"], keep?: string) => {
  // Saving items use the fixed saving groups (Tiết kiệm, Mua nhà…), not the family's expense/income list.
  const names = kind === "saving" ? [...SAVING_CATEGORIES] : categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  return keep && !names.includes(keep) ? [keep, ...names] : names;
};

/** Add / edit one fixed item: schedule, name, Thu/Chi, group, day(s), amount (fixed or estimated), live preview. */
export function FixedItemForm({ existing, month, categories, onSave, onCancel }: Props) {
  const uid = useId(); const id = (name: string) => `${uid}-${name}`;
  const today = todayLocal();
  const [form, setForm] = useState<RecurringForm>(() => existing ? formFromItem(existing) : emptyForm(categoryNames(categories, "expense")[0] ?? "Khác"));
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const patch = (change: Partial<RecurringForm>) => setForm((current) => ({ ...current, ...change }));
  const options = categoryNames(categories, form.kind, form.category);
  const preview = previewText(form);
  const showDone = !existing && monthWindow(form, month, today) !== "none";

  function changeKind(kind: RecurringForm["kind"]) {
    const names = categoryNames(categories, kind);
    patch({ kind, category: names.includes(form.category) ? form.category : names[0] ?? "Khác" });
  }
  async function submit() {
    const read = readForm(form, { id: existing?.id ?? crypto.randomUUID(), month, today, existing });
    if ("error" in read) { setError(read.error); return; }
    setBusy(true); setError("");
    try { await onSave(read.item); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); setBusy(false); }
  }
  const dayLabel = form.schedule === "range" || form.schedule === "quarter" ? "Từ ngày" : "Ngày";

  return <form className="pl-form" aria-label={existing ? `Sửa ${existing.name}` : "Thêm khoản cố định"} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <div className="pl-f wide"><span className="pl-flabel" id={id("sched")}>Lịch</span>
      <div className="pl-seg" role="group" aria-labelledby={id("sched")}>{SCHEDULE_KINDS.map((item) => <button type="button" key={item.kind} aria-pressed={form.schedule === item.kind} className={form.schedule === item.kind ? "on" : undefined} onClick={() => patch({ schedule: item.kind })}>{item.label}</button>)}</div></div>
    <div className="pl-f wide"><label htmlFor={id("name")}>Tên khoản</label><input ref={nameRef} id={id("name")} value={form.name} maxLength={80} placeholder="Tiền điện, Lương, Học phí…" autoComplete="off" onChange={(event) => patch({ name: event.target.value })} /></div>
    <div className="pl-f"><label htmlFor={id("kind")}>Loại</label><select id={id("kind")} value={form.kind} onChange={(event) => changeKind(event.target.value as RecurringForm["kind"])}><option value="expense">Chi</option><option value="income">Thu</option><option value="saving">Tiết kiệm</option></select></div>
    <div className="pl-f"><label htmlFor={id("cat")}>Nhóm</label><select id={id("cat")} value={form.category} onChange={(event) => patch({ category: event.target.value })}>{options.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
    {form.schedule === "year" && <div className="pl-f"><label htmlFor={id("ym")}>Tháng</label><select id={id("ym")} value={form.yearMonth} onChange={(event) => patch({ yearMonth: event.target.value })}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1)}>Tháng {index + 1}</option>)}</select></div>}
    {form.schedule !== "eom" && <div className="pl-f"><label htmlFor={id("day")}>{dayLabel}</label><input id={id("day")} value={form.day} inputMode="numeric" maxLength={2} onChange={(event) => patch({ day: event.target.value })} /></div>}
    {(form.schedule === "range" || form.schedule === "quarter" || form.schedule === "year") && <div className="pl-f"><label htmlFor={id("to")}>Đến ngày{form.schedule === "range" ? "" : " (tuỳ chọn)"}</label><input id={id("to")} value={form.to} inputMode="numeric" maxLength={2} onChange={(event) => patch({ to: event.target.value })} /></div>}
    <div className="pl-f wide"><span className="pl-flabel" id={id("mode")}>Số tiền</span>
      <div className="pl-seg" role="group" aria-labelledby={id("mode")}>
        <button type="button" aria-pressed={form.mode === "fixed"} className={form.mode === "fixed" ? "on" : undefined} onClick={() => patch({ mode: "fixed" })}>Cố định</button>
        <button type="button" aria-pressed={form.mode === "estimate"} className={form.mode === "estimate" ? "on" : undefined} onClick={() => patch({ mode: "estimate" })}>Ước lượng (TB 3 kỳ gần nhất)</button>
      </div></div>
    <div className="pl-f"><label htmlFor={id("amt")}>{form.mode === "estimate" ? "Số tiền lần đầu" : "Số tiền cố định"}</label><AmountInput id={id("amt")} value={form.amount} placeholder="600k" onChange={(event) => patch({ amount: event.target.value })} /></div>
    <p className="pl-preview wide" aria-live="polite"><b>{preview.name}</b> {preview.rest}</p>
    {showDone && <label className="pl-check wide"><input type="checkbox" checked={isDone(form, month, today)} onChange={(event) => patch({ done: event.target.checked })} />Tháng này đã xong rồi <small>({doneWord(form.kind).toLowerCase()}, đừng hỏi lại kỳ này)</small></label>}
    {error && <p className="form-error wide" role="alert">{error}</p>}
    <div className="pl-acts wide"><button type="button" className="app-btn ghost pl-btn" onClick={onCancel} disabled={busy}>Hủy</button><button type="submit" className="app-btn pl-btn" disabled={busy}>{busy ? "Đang lưu…" : "Lưu khoản cố định"}</button></div>
  </form>;
}
