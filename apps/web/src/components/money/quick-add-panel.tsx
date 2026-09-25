"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cloudEnabled } from "@/lib/experience/cloud";
import { trackEvent } from "@/lib/experience/storage";
import { shrinkImage } from "@/lib/image/shrink";
import { parseVnd, todayLocal } from "@/lib/money/parse";
import { draftsFromImage, parseQuickList, type ImageLine, type QuickContext, type QuickDraft } from "@/lib/money/quick-add";
import { shortVnd } from "@/lib/money/summary";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyCategory, type MoneyKind } from "@/lib/money/types";

interface Props {
  context: Omit<QuickContext, "today">;
  aiConsent: boolean;
  /** Writes the selected drafts (and remembers corrections); throws with a message on failure. */
  onSave: (drafts: QuickDraft[]) => Promise<void>;
  onCreateCategory: (category: MoneyCategory) => Promise<void>;
}

const EXAMPLE = "12/9 ăn sáng 35k, cf 45k, đổ xăng 80k\n13/9 bỉm shopee 329k\n15/9 lương t9 25tr";

/**
 * "Thêm nhanh bằng Trợ lý" on top of the ledger: paste a list or send a photo → the agent splits and classifies
 * each line → the family reviews (unsure categories highlighted, likely duplicates unselected) → Ghi vào sổ.
 */
export function QuickAddPanel({ context, aiConsent, onSave, onCreateCategory }: Props) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<QuickDraft[] | null>(null);
  const [from, setFrom] = useState<"text" | "photo">("text");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [photoReady, setPhotoReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [refining, setRefining] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/money/read-image").then((response) => response.json()).then((data: { available?: boolean }) => setPhotoReady(Boolean(data.available))).catch(() => setPhotoReady(false)); }, []);
  useEffect(() => { fetch("/api/money/classify").then((response) => response.json()).then((data: { available?: boolean }) => setAiReady(Boolean(data.available))).catch(() => setAiReady(false)); }, []);

  const full = (): QuickContext => ({ ...context, today: todayLocal() });
  const options = (kind: MoneyKind) => kind === "saving" ? SAVING_CATEGORIES : context.categories.filter((item) => item.kind === kind && !item.archived).map((item) => item.name);
  const update = (key: string, patch: Partial<QuickDraft>) => setDrafts((current) => current?.map((draft) => draft.key === key ? { ...draft, ...patch } : draft) ?? null);

  /** Second pass: lines the rules were unsure about go to the model (text only); answers must be one of our categories. */
  async function refine(found: QuickDraft[]) {
    const unsure = found.map((draft, i) => ({ draft, i })).filter(({ draft }) => draft.unsure && draft.kind !== "saving");
    if (!aiReady || !aiConsent || !unsure.length) return;
    setRefining(unsure.length);
    try {
      const body = { lines: unsure.slice(0, 80).map(({ draft, i }) => ({ i, content: draft.content, kind: draft.kind })), categories: { expense: options("expense"), income: options("income") }, children: context.children ?? [], aiConsent: cloudEnabled ? undefined : aiConsent };
      const response = await fetch("/api/money/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { items?: Array<{ i: number; kind: "expense" | "income"; category: string }>; error?: string };
      if (!response.ok || !data.items) throw new Error(data.error || "Trợ lý AI chưa xếp được, bạn chọn nhóm giúp nhé.");
      const byLine = new Map(data.items.filter((item) => item.category !== "Khác").map((item) => [found[item.i]?.key, item]));
      setDrafts((current) => current?.map((draft) => { const answer = byLine.get(draft.key); return answer && draft.unsure ? { ...draft, kind: answer.kind, category: answer.category, unsure: false, suggestNew: undefined, aiPicked: true } : draft; }) ?? null);
      trackEvent("money_quick_ai_refined", { asked: unsure.length, placed: byLine.size });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Trợ lý AI chưa xếp được."); }
    finally { setRefining(0); }
  }

  function classify() {
    setError(""); setDone("");
    const found = parseQuickList(text, full());
    if (!found.length) { setError("Chưa thấy khoản nào có số tiền. Mỗi khoản một dòng hoặc cách nhau bằng dấu phẩy, ví dụ: ăn sáng 35k, cf 45k."); return; }
    setFrom("text"); setDrafts(found); trackEvent("money_quick_parsed", { lines: found.length, source: "text" });
    void refine(found);
  }

  async function readPhoto(file: File) {
    setBusy(true); setError(""); setDone("");
    try {
      const image = await shrinkImage(file);
      const response = await fetch("/api/money/read-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, aiConsent: cloudEnabled ? undefined : aiConsent }) });
      const data = await response.json().catch(() => ({})) as { lines?: ImageLine[]; error?: string };
      if (!response.ok || !data.lines) throw new Error(data.error || "Chưa đọc được ảnh.");
      const found = draftsFromImage(data.lines, full());
      setFrom("photo"); setDrafts(found); trackEvent("money_quick_parsed", { lines: found.length, source: "photo" });
      void refine(found);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa đọc được ảnh."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function save() {
    if (!drafts) return;
    const chosen = drafts.filter((draft) => draft.selected);
    if (!chosen.length) { setError("Chọn ít nhất một khoản để ghi."); return; }
    if (chosen.some((draft) => !draft.content.trim() || !draft.amount)) { setError("Mỗi khoản cần nội dung và số tiền."); return; }
    setBusy(true); setError("");
    try { await onSave(drafts); setDone(`✓ Đã ghi ${chosen.length} khoản vào sổ.`); setDrafts(null); setText(""); trackEvent("money_quick_saved", { lines: chosen.length, source: from }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa ghi được."); }
    finally { setBusy(false); }
  }

  async function createCategory(draft: QuickDraft) {
    if (!draft.suggestNew) return;
    try { await onCreateCategory({ name: draft.suggestNew, kind: "expense" }); update(draft.key, { category: draft.suggestNew, unsure: false, suggestNew: undefined }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa tạo được nhóm."); }
  }

  const chosen = drafts?.filter((draft) => draft.selected) ?? [];
  const sum = (kind: MoneyKind) => chosen.filter((draft) => draft.kind === kind).reduce((total, draft) => total + draft.amount, 0);
  const totals = ([["expense", "Chi"], ["income", "Thu"], ["saving", "Tiết kiệm"]] as const).filter(([kind]) => sum(kind)).map(([kind, label]) => `${label} ${shortVnd(sum(kind))}`).join(" · ");

  return <section className="app-card quick-add" aria-label="Thêm nhanh bằng Trợ lý">
    <div className="quick-head"><span className="app-orb" aria-hidden="true" /><div>
      <b>{drafts ? `Trợ lý đọc được ${drafts.length} khoản` : "Thêm nhanh bằng Trợ lý"}</b>
      <small>{drafts ? <>Xem lại từng dòng rồi ghi. Nhóm tô cam là Trợ lý chưa chắc; dòng có thể trùng đã bỏ chọn sẵn. <button type="button" className="ledger-link" onClick={() => setDrafts(null)}>{from === "photo" ? "Đọc ảnh khác" : "Sửa đoạn đã dán"}</button></> : "Dán danh sách hoặc gửi ảnh, mỗi khoản một dòng hoặc cách nhau bằng dấu phẩy. Viết tắt cũng được (35k, 2tr5, t9)."}</small>
    </div></div>

    {!drafts && <>
      <textarea aria-label="Danh sách giao dịch" placeholder={EXAMPLE} value={text} maxLength={8000} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) classify(); }} />
      <div className="quick-bar">
        <div className="left">
          {photoReady && <><input ref={input} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readPhoto(file); }} />
            <button type="button" className="app-btn ghost" disabled={busy || !aiConsent} onClick={() => input.current?.click()}>{busy ? "Đang đọc ảnh…" : "Gửi ảnh"}</button>
            <small>{aiConsent ? "Sao kê · ảnh chụp app ngân hàng · hóa đơn · sổ tay" : <>Bật “Cho phép FamAgent dùng AI” ở <Link className="brief-link" href="/family">Gia đình</Link> để gửi ảnh</>}</small></>}
        </div>
        <button type="button" className="app-btn" disabled={busy || !text.trim()} onClick={classify}>Phân loại giúp tôi</button>
      </div>
    </>}

    {drafts && <>
      {refining > 0 && <p className="app-sub quick-note" role="status">Trợ lý AI đang xếp nhóm cho {refining} dòng chưa chắc…</p>}
      {from === "photo" && <p className="app-sub quick-note">Ảnh chỉ được gửi tới nhà cung cấp AI để đọc, không lưu lại. Đối chiếu số tiền với ảnh trước khi ghi.</p>}
      <div className="quick-scroll"><table className="quick-review">
        <thead><tr><th><span className="sr-only">Chọn</span></th><th>Ngày</th><th>Nội dung</th><th>Loại</th><th>Nhóm</th><th className="num">Số tiền</th></tr></thead>
        <tbody>{drafts.map((draft) => <tr key={draft.key} className={`${draft.unsure ? "unsure" : ""}${draft.dupeOf && !draft.selected ? " dupe" : ""}`}>
          <td><input type="checkbox" aria-label={`Ghi “${draft.content}”`} checked={draft.selected} onChange={(event) => update(draft.key, { selected: event.target.checked })} /></td>
          <td><input type="date" aria-label="Ngày" value={draft.occurredOn} onChange={(event) => update(draft.key, { occurredOn: event.target.value, dateNote: undefined })} />{draft.dateNote && <span className="flag">{draft.dateNote}</span>}</td>
          <td><input aria-label="Nội dung" value={draft.content} maxLength={120} onChange={(event) => update(draft.key, { content: event.target.value })} />{draft.forChild && <span className="flag ok">Cho con</span>}</td>
          <td><select aria-label="Loại" value={draft.kind} onChange={(event) => { const kind = event.target.value as MoneyKind; const first = options(kind)[0] ?? "Khác"; update(draft.key, { kind, category: first, amount: Math.abs(draft.amount), unsure: false, suggestNew: undefined }); }}>{(Object.keys(MONEY_KIND_LABELS) as MoneyKind[]).map((kind) => <option key={kind} value={kind}>{MONEY_KIND_LABELS[kind]}</option>)}</select></td>
          <td><select className="cat" aria-label="Nhóm" value={draft.category} onChange={(event) => update(draft.key, { category: event.target.value, unsure: false })}>{[...new Set([draft.category, ...options(draft.kind)])].map((name) => <option key={name}>{name}</option>)}</select>
            {draft.aiPicked && <span className="flag ai">Trợ lý AI xếp · kiểm tra lại</span>}
            {draft.unsure && <span className="flag">Chưa chắc{draft.suggestNew ? <> · <button type="button" className="ledger-link" onClick={() => void createCategory(draft)}>tạo nhóm “{draft.suggestNew}”?</button></> : ""}</span>}</td>
          <td className="num"><input aria-label="Số tiền" inputMode="decimal" defaultValue={draft.amount.toLocaleString("vi-VN")} onBlur={(event) => { const value = parseVnd(event.target.value); if (value !== null && (value > 0 || draft.kind === "saving")) update(draft.key, { amount: value }); else event.target.value = draft.amount.toLocaleString("vi-VN"); }} />
            {draft.dupeOf && <span className="flag">Có thể trùng {draft.dupeOf}</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="review-foot"><span><b>{chosen.length} khoản đã chọn</b>{totals && <small> · {totals}</small>}</span>
        <span className="row-actions"><button type="button" className="app-btn ghost" disabled={busy} onClick={() => setDrafts(null)}>Hủy</button><button type="button" className="app-btn" disabled={busy || !chosen.length} onClick={() => void save()}>{busy ? "Đang ghi…" : `Ghi ${chosen.length} khoản vào sổ`}</button></span></div>
      <p className="app-sub quick-note">Đổi nhóm của một dòng thì lần sau Trợ lý tự xếp dòng giống vậy vào nhóm bạn chọn.</p>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {done && <p className="app-sub quick-done" role="status">{done}</p>}
  </section>;
}
