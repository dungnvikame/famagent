"use client";

import { useState } from "react";
import { allocatable, allocationFrom, allocationTotal, BUCKET_COLORS, CUSTOM_NAME, unassigned } from "@/lib/money/allocation";
import type { FrameworkId } from "@/lib/money/frameworks";
import { DEFAULT_CATEGORIES, type AllocationBucket, type MoneyAllocation, type MoneyCategory } from "@/lib/money/types";
import { vnd } from "@/lib/catalog/format";
import { parseVnd } from "@/lib/money/parse";
import { AmountInput } from "./amount-input";

interface Props {
  initial: MoneyAllocation;
  categories: MoneyCategory[];
  /** Income the shares apply to (this month's, else the onboarding estimate); 0 = unknown. */
  income: number;
  onSave: (allocation: MoneyAllocation, categories: MoneyCategory[]) => Promise<void>;
  onCancel: () => void;
}

const PRESETS: Array<{ id: FrameworkId | "blank"; label: string }> = [{ id: "blank", label: "Trống" }, { id: "50-30-20", label: "50/30/20" }, { id: "jars", label: "6 chiếc lọ" }, { id: "pay-first", label: "Trả cho mình trước" }];
const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map((item) => item.name));
const pct = (share: number) => Math.round(share * 1000) / 10;

/**
 * "Tự thiết kế theo nhà mình": named parts with a share of income and the ledger categories that count toward
 * each; the family can add its own categories here too. Saving needs the shares to add up to exactly 100%.
 */
export function AllocationEditor({ initial, categories: startCategories, income, onSave, onCancel }: Props) {
  // Fixed-amount parts show their share of this month's income.
  const [buckets, setBuckets] = useState<AllocationBucket[]>(() => initial.buckets.map((bucket) => bucket.amount && income > 0 ? { ...bucket, share: bucket.amount / income } : bucket));
  const [categories, setCategories] = useState<MoneyCategory[]>(startCategories);
  const [preset, setPreset] = useState<string>("");
  const [draft, setDraft] = useState({ name: "", kind: "expense" as MoneyCategory["kind"], bucket: initial.buckets[0]?.key ?? "" });
  const [error, setError] = useState("");
  // What the person is typing in an amount box (so it can be cleared and retyped).
  const [typing, setTyping] = useState<{ key: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const allocation = { buckets };
  const total = allocationTotal(allocation);
  const loose = unassigned(allocation, categories);
  const pool = new Set(allocatable(categories));
  const patch = (key: string, change: Partial<AllocationBucket>) => setBuckets((current) => current.map((bucket) => bucket.key === key ? { ...bucket, ...change } : bucket));
  // Typing a percent makes the part a share of income; typing an amount makes it a fixed monthly amount.
  const setShare = (key: string, value: number) => patch(key, { share: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100, amount: undefined });
  const setAmount = (key: string, text: string) => { const value = text.trim() ? parseVnd(text) : null; if (value === null || value <= 0) { patch(key, { amount: undefined }); return; } patch(key, { amount: value, share: income > 0 ? value / income : buckets.find((bucket) => bucket.key === key)?.share ?? 0 }); };
  const amountText = (bucket: AllocationBucket) => bucket.amount ? bucket.amount.toLocaleString("vi-VN") : income > 0 && bucket.share > 0 ? Math.round(income * bucket.share).toLocaleString("vi-VN") : "";
  const assign = (key: string, name: string) => setBuckets((current) => current.map((bucket) => ({ ...bucket, categories: bucket.key === key ? [...bucket.categories.filter((item) => item !== name), name] : bucket.categories.filter((item) => item !== name) })));

  function addCategory() {
    const name = draft.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40) { setError("Tên nhóm từ 1 đến 40 ký tự."); return; }
    if (categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) { setError(`Đã có nhóm “${name}”.`); return; }
    setError("");
    setCategories((current) => [...current, { name, kind: draft.kind }]);
    if (draft.kind === "expense" && draft.bucket) assign(draft.bucket, name);
    setDraft({ ...draft, name: "" });
  }

  function toggleHidden(name: string) {
    setCategories((current) => current.map((item) => item.name === name ? { ...item, archived: item.archived ? undefined : true } : item));
    // A hidden category stays in past entries but is no longer offered or split.
    setBuckets((current) => current.map((bucket) => ({ ...bucket, categories: bucket.categories.filter((item) => item !== name) })));
  }

  async function save() {
    if (buckets.some((bucket) => !bucket.label.trim())) { setError("Đặt tên cho mọi phần."); return; }
    // No income yet this month: a split made only of amounts is fine, its shares follow the amounts.
    const amountsOnly = income <= 0 && buckets.every((bucket) => bucket.amount);
    const amountSum = buckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0);
    if (!amountsOnly && Math.abs(total - 1) > 0.001) { setError(`Tổng các phần đang là ${pct(total)}%, cần đúng 100%.`); return; }
    // A fixed amount rarely lands on a round percent: the largest percent part takes the tiny rounding gap.
    const flexible = buckets.filter((bucket) => !bucket.amount).sort((a, b) => b.share - a.share)[0];
    const shareOf = (bucket: AllocationBucket) => amountsOnly ? (bucket.amount ?? 0) / amountSum : Math.max(0, Math.min(1, bucket.key === flexible?.key ? bucket.share + 1 - total : bucket.share));
    setBusy(true); setError("");
    try { await onSave({ buckets: buckets.map((bucket) => ({ ...bucket, share: shareOf(bucket), label: bucket.label.trim(), categories: bucket.categories.filter((name) => pool.has(name)) })) }, categories); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); setBusy(false); }
  }

  const colorOf = (index: number) => BUCKET_COLORS[index % BUCKET_COLORS.length];
  return <div className="alloc">
    <div className="fw-panel-head"><div><b>{CUSTOM_NAME}</b><small>Chỉnh thoải mái, đổi lại lúc nào cũng được. Số liệu các tháng đã ghi không đổi.</small></div><button type="button" className="ledger-link" onClick={onCancel}>Đóng</button></div>
    <div className="alloc-from" role="group" aria-label="Bắt đầu từ mẫu">Bắt đầu từ:{PRESETS.map((item) => <button type="button" key={item.id} className={`chip${preset === item.id ? " on" : ""}`} onClick={() => { setPreset(item.id); setBuckets(allocationFrom(item.id, categories).buckets); }}>{item.label}</button>)}</div>
    <p className="alloc-income">{income > 0 ? <>Chia theo thu nhập tháng này ≈ <b>{vnd(income)}</b></> : "Ghi khoản thu (lương) tháng này để thấy mỗi phần là bao nhiêu tiền."}</p>

    {buckets.map((bucket, index) => {
      const others = allocatable(categories).filter((name) => !bucket.categories.includes(name));
      return <div className="bucket" key={bucket.key}>
        <div className="bucket-top">
          <span className="dot" style={{ background: colorOf(index) }} aria-hidden="true" />
          <input className="name" aria-label="Tên phần" value={bucket.label} maxLength={40} onChange={(event) => patch(bucket.key, { label: event.target.value })} />
          <span className="pct"><input aria-label={`Tỷ lệ ${bucket.label}`} inputMode="decimal" value={pct(bucket.share)} onChange={(event) => setShare(bucket.key, Number(event.target.value.replace(",", ".")))} /><span>%</span></span>
          <span className={`amt-field${bucket.amount ? " fixed" : ""}`}><AmountInput aria-label={`Số tiền ${bucket.label}`} placeholder="Số tiền" value={typing?.key === bucket.key ? typing.text : amountText(bucket)} onChange={(event) => { setTyping({ key: bucket.key, text: event.target.value }); setAmount(bucket.key, event.target.value); }} onBlur={() => setTyping(null)} /><span>đ</span>{bucket.amount ? <small>cố định</small> : null}</span>
          <button type="button" className="x" aria-label={`Xóa phần ${bucket.label}`} disabled={buckets.length <= 1} onClick={() => setBuckets((current) => current.filter((item) => item.key !== bucket.key))}>×</button>
        </div>
        <input type="range" min={0} max={100} step={1} aria-label={`Kéo tỷ lệ ${bucket.label}`} value={pct(bucket.share)} onChange={(event) => setShare(bucket.key, Number(event.target.value))} />
        <div className="bucket-cats"><small>Nhóm chi:</small>
          {bucket.categories.filter((name) => pool.has(name)).map((name) => <span key={name} className={`chip cat${DEFAULT_NAMES.has(name) ? "" : " fresh"}`}>{name}<button type="button" aria-label={`Bỏ ${name} khỏi ${bucket.label}`} onClick={() => patch(bucket.key, { categories: bucket.categories.filter((item) => item !== name) })}>×</button></span>)}
          {others.length > 0 && <select className="chip add" aria-label={`Gắn nhóm vào ${bucket.label}`} value="" onChange={(event) => { if (event.target.value) assign(bucket.key, event.target.value); }}>
            <option value="">+ Gắn nhóm</option>
            {others.map((name) => <option key={name} value={name}>{name}{loose.includes(name) ? "" : " (chuyển từ phần khác)"}</option>)}
          </select>}
        </div>
      </div>;
    })}
    <div><button type="button" className="app-btn ghost" disabled={buckets.length >= 12} onClick={() => setBuckets((current) => [...current, { key: `b${Date.now().toString(36)}`, label: `Phần ${current.length + 1}`, share: Math.max(0, Math.round((1 - total) * 1000) / 1000), categories: [] }])}>+ Thêm phần</button></div>

    <div className="alloc-total">
      <div className="stack" aria-hidden="true">{buckets.map((bucket, index) => <span key={bucket.key} style={{ width: `${Math.min(100, bucket.share * 100)}%`, background: colorOf(index) }} />)}</div>
      {income <= 0 && buckets.every((bucket) => bucket.amount) ? <div className="row"><span>Tổng: <b>{vnd(buckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0))}</b>/tháng</span><span className="ok-text">✓ Chia theo số tiền</span></div> :
      <div className="row"><span>Tổng: <b>{pct(total)}%</b>{income > 0 ? ` của ${vnd(income)}` : ""}</span>{Math.abs(total - 1) <= 0.001 ? <span className="ok-text">✓ Đã chia hết</span> : total < 1 ? <span className="warn-text">Còn {pct(1 - total)}% chưa chia</span> : <span className="warn-text">Vượt {pct(total - 1)}%</span>}</div>}
    </div>
    {loose.length > 0 && <div className="alloc-loose">Chưa thuộc phần nào: {loose.map((name) => <span key={name} className="chip cat">{name}</span>)}<small>Chọn “+ Gắn nhóm” ở phần phù hợp.</small></div>}

    <div className="cats-manage">
      <h3>Nhóm chi tiêu của nhà mình</h3>
      <div className="cats-row">{categories.map((item) => <button type="button" key={`${item.kind}:${item.name}`} className={`chip cat${item.archived ? " hidden" : ""}${DEFAULT_NAMES.has(item.name) ? "" : " fresh"}`} title={item.archived ? "Đang ẩn — bấm để hiện lại" : "Bấm để ẩn nhóm này"} onClick={() => toggleHidden(item.name)}>{item.kind === "income" ? "Thu · " : ""}{item.name}{item.archived ? " (ẩn)" : ""}</button>)}</div>
      <div className="cats-add">
        <input aria-label="Tên nhóm mới" placeholder="Tên nhóm mới, ví dụ: Đi lại" value={draft.name} maxLength={40} onChange={(event) => setDraft({ ...draft, name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} />
        <select aria-label="Loại nhóm" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MoneyCategory["kind"] })}><option value="expense">Khoản chi</option><option value="income">Khoản thu</option></select>
        {draft.kind === "expense" && <select aria-label="Thuộc phần" value={draft.bucket} onChange={(event) => setDraft({ ...draft, bucket: event.target.value })}>{buckets.map((bucket) => <option key={bucket.key} value={bucket.key}>Thuộc phần: {bucket.label}</option>)}</select>}
        <button type="button" className="app-btn" onClick={addCategory}>Thêm nhóm</button>
      </div>
      <small className="app-sub">Bấm vào một nhóm để ẩn hoặc hiện lại. Nhóm bị ẩn vẫn giữ trong các khoản đã ghi, chỉ không hiện khi ghi mới.</small>
    </div>

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="alloc-actions"><button type="button" className="app-btn ghost" disabled={busy} onClick={onCancel}>Hủy</button><button type="button" className="app-btn" disabled={busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu cách chia"}</button></div>
  </div>;
}
