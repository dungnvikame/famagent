"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/experience/storage";
import type { ExpenseDraft } from "@/lib/inbox/classify";
import { saveMoneyItem } from "@/lib/money/client";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { DEFAULT_CATEGORIES } from "@/lib/money/types";

/** Plain expense / income from the Inbox: "Chi 80K · Ăn uống · “Ăn trưa” · hôm nay. Đúng không?" → one ledger row. */
export function MoneyDraftCard({ draft, summary, onSaved, onCancel }: { draft: ExpenseDraft; summary: string; onSaved: (text: string) => void; onCancel: () => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(draft.content);
  const [amount, setAmount] = useState(String(draft.amount));
  const [category, setCategory] = useState(draft.category);
  const [date, setDate] = useState(draft.occurredOn);
  const [kind, setKind] = useState(draft.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const categories = DEFAULT_CATEGORIES.filter((entry) => entry.kind === kind).map((entry) => entry.name);

  async function save() {
    const value = parseVnd(amount);
    if (!value || value <= 0) { setError("Nhập số tiền (ví dụ 80k)."); setEditing(true); return; }
    if (!content.trim()) { setError("Nhập nội dung."); setEditing(true); return; }
    setBusy(true); setError("");
    try {
      await saveMoneyItem("transactions", { id: crypto.randomUUID(), occurredOn: date, content: content.trim().slice(0, 120), category, kind, amount: value, forChild: category === "Con", source: "manual" });
      trackEvent("inbox_money_saved", { kind, category });
      onSaved(`✓ Đã ghi ${kind === "income" ? "khoản thu" : "khoản chi"} ${content.trim()} vào Tiền`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được."); }
    finally { setBusy(false); }
  }

  if (!editing) return <div className="app-card draft-card draft-summary" role="group" aria-label="Xác nhận khoản tiền">
    <p>Tôi hiểu đây là <b>{summary}</b>. Đúng không?</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <span className="purchase-actions"><button type="button" className="app-btn" disabled={busy} onClick={() => void save()}>{busy ? "Đang ghi…" : "Đúng"}</button><button type="button" className="app-btn ghost" onClick={() => setEditing(true)}>Sửa</button><button type="button" className="ledger-link" onClick={onCancel}>Bỏ</button></span>
  </div>;
  return <form className="app-card draft-card" aria-label="Sửa khoản tiền" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <span className="chip-row" role="radiogroup" aria-label="Loại khoản">{(["expense", "income"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={kind === value} className={`chip${kind === value ? " on" : ""}`} onClick={() => { setKind(value); const first = DEFAULT_CATEGORIES.find((entry) => entry.kind === value)?.name; if (first && !DEFAULT_CATEGORIES.some((entry) => entry.kind === value && entry.name === category)) setCategory(first); }}>{value === "income" ? "Khoản thu" : "Khoản chi"}</button>)}</span>
    <div className="draft-row">
      <label className="grow">Nội dung<input value={content} onChange={(event) => setContent(event.target.value)} /></label>
      <label>Số tiền<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    </div>
    <div className="draft-row">
      <label className="grow">Nhóm<select value={category} onChange={(event) => setCategory(event.target.value)}>{[...new Set([category, ...categories])].map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>Ngày<input type="date" value={date} max={todayLocal()} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <span className="purchase-actions"><button type="submit" className="app-btn" disabled={busy}>{busy ? "Đang ghi…" : "Ghi lại"}</button><button type="button" className="ledger-link" onClick={onCancel}>Hủy</button></span>
  </form>;
}
