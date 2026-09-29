"use client";

import { useId, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { vndCompact } from "@/lib/money/format-vnd";
import { groupAmountTyping, parseVnd } from "@/lib/money/parse";
import { effectivePlan, flexibleBudget } from "@/lib/money/plan";
import { budgetBalance, budgetRows, type BudgetRow } from "@/lib/money/plan-model";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBudget, MoneyBundle } from "@/lib/money/types";
import { AmountInput } from "./amount-input";

interface Props {
  bundle: MoneyBundle; summary: MonthSummary; month: string;
  onBudget: (item: MoneyBudget) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
}

/** "Ngân sách theo nhóm": the flexible budget shared by usual spend; click a limit to set your own for this month. */
export function BudgetPlan({ bundle, summary, month, onBudget, onDeleteBudget }: Props) {
  const inputId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const rows = budgetRows(summary, bundle.budgets, month);
  const plan = effectivePlan(bundle.settings, bundle.recurring, month, bundle.recurringAmounts);
  const flexible = plan === undefined ? 0 : flexibleBudget(plan, bundle.recurring, bundle.recurringAmounts);
  const { total, free } = budgetBalance(rows, flexible);

  async function run(task: () => Promise<void>) {
    setBusy(true); setError("");
    try { await task(); setEditing(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); } finally { setBusy(false); }
  }
  function save(row: BudgetRow) {
    const limitAmount = parseVnd(draft);
    if (limitAmount === null || limitAmount <= 0) { setError("Số tiền chưa đúng (ví dụ 4tr)."); return; }
    void run(() => onBudget({ id: row.budgetId ?? crypto.randomUUID(), category: row.category, month, limitAmount }));
  }

  return <section className="app-card pl-card" aria-labelledby="pl-bud-h">
    <h3 id="pl-bud-h">Ngân sách theo nhóm <small>tự chia từ phần chi linh hoạt</small></h3>
    {rows.length === 0 ? <p className="pl-empty">Chia theo mức chi trung bình 3 tháng của từng nhóm. Cần đặt tiết kiệm mỗi tháng ở trên và có vài tháng ghi chi tiêu thì app mới tự chia được.</p> : <>
      <p className="pl-hint">Chia theo mức chi trung bình 3 tháng của từng nhóm. Bấm số để sửa một nhóm: các nhóm còn lại tự co giãn để tổng vẫn khớp.</p>
      <div className="pl-buds">{rows.map((row) => {
        const over = row.spent > row.limit;
        return <div className={`pl-bud${editing === row.category ? " editing" : ""}`} key={row.category}>
          <span className="pl-bud-name">{row.category}</span>
          <span className="pl-track" role="img" aria-label={`Đã chi ${vndCompact(row.spent)} trên ${vndCompact(row.limit)}`}><i className={over ? "over" : undefined} style={{ width: `${Math.min(100, row.limit > 0 ? row.spent / row.limit * 100 : 0)}%` }} /></span>
          {editing === row.category
            ? <form className="pl-bud-edit" onSubmit={(event) => { event.preventDefault(); save(row); }}>
              <label className="sr-only" htmlFor={inputId}>Ngân sách {row.category} tháng này</label>
              <AmountInput id={inputId} autoFocus value={draft} placeholder="4tr" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }} />
              <button type="submit" className="app-btn pl-btn" disabled={busy}>Lưu</button>
              <button type="button" className="pl-link" onClick={() => setEditing(null)}>Hủy</button>
            </form>
            : <span className="pl-bud-amt"><small>{vndCompact(row.spent)} / </small><button type="button" className="pl-limit" aria-label={`Sửa ngân sách ${row.category}, đang ${vnd(row.limit)}`} onClick={() => { setError(""); setDraft(groupAmountTyping(String(row.limit))); setEditing(row.category); }}>{vndCompact(row.limit)}</button>{over && <small className="pl-over"> · vượt {vndCompact(row.spent - row.limit)}</small>}</span>}
          <span className="pl-bud-src">{row.source === "set" ? <>Bạn đặt{row.budgetId && <button type="button" className="pl-link" disabled={busy} aria-label={`Đưa ${row.category} về tự động`} onClick={() => void run(() => onDeleteBudget(row.budgetId!))}>Về tự động</button>}</> : row.average > 0 ? "TB 3 tháng" : "Tự chia"}</span>
        </div>;
      })}</div>
      <div className="pl-note">Tổng ngân sách nhóm <b>{vnd(total)}</b> {free >= 0 ? "= phần chi linh hoạt" : "vượt phần chi linh hoạt"} · {free >= 0 ? "chưa phân bổ" : "vượt"} <b>{vnd(Math.abs(free))}</b>. Chỉ áp cho tháng này; tháng sau tự chia lại.</div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
