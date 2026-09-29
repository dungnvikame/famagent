"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile, trackEvent } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import { deleteMoneyItem, loadMoney, saveMoneySettings, undoPeriod } from "@/lib/money/client";
import { autoDebtId, REPAYMENT_CATEGORIES } from "@/lib/money/debt-link";
import { buildEntry } from "@/lib/money/entry";
import { formatVnDate, parseVnd, todayLocal } from "@/lib/money/parse";
import { periodAnswered, saveNewEntry } from "@/lib/money/save-entry";
import { guessEntry, rememberCategory, type QuickContext } from "@/lib/money/quick-add";
import { monthKey } from "@/lib/money/summary";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyBundle, type MoneyKind } from "@/lib/money/types";
import { AmountInput } from "./amount-input";
import { DateInput } from "./date-input";

/** Fired after the sheet writes or undoes an entry, so the page underneath (Tiền, Trang chủ) reloads its numbers. */
export const MONEY_CHANGED_EVENT = "famagent:money-changed";

interface Ctl { open: () => void }
const QuickEntryContext = createContext<Ctl>({ open: () => {} });
export const useQuickEntry = () => useContext(QuickEntryContext);

const KINDS: MoneyKind[] = ["expense", "income", "saving"];
const isTyping = (el: Element | null) => !!el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || (el as HTMLElement).isContentEditable);

/** Kind + category for what was typed: the chosen kind first; unless the family fixed the kind, the other one when only it reads clearly ("lương t9"). */
function autoGuess(content: string, kind: MoneyKind, kindFixed: boolean, context: QuickContext) {
  if (kind === "saving" || !content.trim()) return null;
  const first = guessEntry(content, kind, context);
  if (!kindFixed && first.unsure) {
    const other = kind === "expense" ? "income" : "expense";
    const second = guessEntry(content, other, context);
    if (!second.unsure) return { kind: other as MoneyKind, ...second };
  }
  return { kind, ...first };
}

interface Loaded { bundle: MoneyBundle; children: ChildProfile[] }

/** Wraps the signed-in shell: one "Ghi khoản" sheet reachable from every page (button, phone FAB, key N). */
export function QuickEntryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const opener = useRef<Element | null>(null);
  const openSheet = useCallback(() => { opener.current = document.activeElement; setMounted(true); setOpen(true); }, []);
  const closeSheet = useCallback(() => { setOpen(false); (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true }); }, []);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((text: string, undo?: () => void) => { setToast({ text, undo }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 7000); }, []);
  const ctl = useMemo(() => ({ open: openSheet }), [openSheet]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(document.activeElement)) return;
      event.preventDefault(); openSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSheet]);
  useEffect(() => { document.documentElement.classList.toggle("qe-lock", open); return () => document.documentElement.classList.remove("qe-lock"); }, [open]);

  return <QuickEntryContext.Provider value={ctl}>
    {children}
    {mounted && <QuickEntrySheet open={open} onClose={closeSheet} onSaved={say} />}
    {toast && <div className="qe-toast" role="status">{toast.text}{toast.undo && <button type="button" onClick={() => { toast.undo?.(); setToast(null); }}>Hoàn tác</button>}</div>}
  </QuickEntryContext.Provider>;
}

function QuickEntrySheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (text: string, undo?: () => void) => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [content, setContent] = useState("");
  const [amountText, setAmountText] = useState("");
  const [kindChoice, setKindChoice] = useState<MoneyKind | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [fromSavings, setFromSavings] = useState<boolean | null>(null);
  const [forChild, setForChild] = useState<boolean | null>(null);
  const [debtChoice, setDebtChoice] = useState<string | null>(null);
  const [childId, setChildId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);

  // Fresh numbers each time the sheet opens: categories, what the family corrected before, this month's entries.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDate(todayLocal()); setError("");
    Promise.all([loadMoney(monthKey(new Date())), (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).catch(() => null)])
      .then(([bundle, profile]) => { if (!cancelled) setLoaded({ bundle, children: profile?.children ?? [] }); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải sổ thu chi."); });
    const focus = setTimeout(() => textRef.current?.focus({ preventScroll: true }), 220);
    return () => { cancelled = true; clearTimeout(focus); };
  }, [open]);

  const context: QuickContext | null = useMemo(() => loaded ? {
    today: todayLocal(), categories: loaded.bundle.settings.categories, memory: loaded.bundle.settings.categoryMemory, existing: loaded.bundle.transactions,
    children: loaded.children.map((child) => child.name).filter((name): name is string => Boolean(name?.trim())),
  } : null, [loaded]);
  const guess = useMemo(() => context ? autoGuess(content, kindChoice ?? "expense", kindChoice !== null, context) : null, [content, kindChoice, context]);
  const kind = kindChoice ?? guess?.kind ?? "expense";
  const options = useMemo(() => kind === "saving" ? [...SAVING_CATEGORIES] : (loaded?.bundle.settings.categories ?? []).filter((item) => item.kind === kind && !item.archived).map((item) => item.name), [kind, loaded]);
  const category = pickedCategory && (kind === "saving" || options.includes(pickedCategory)) ? pickedCategory : guess?.category ?? options[0] ?? "Khác";
  const unsure = pickedCategory === null && kind !== "saving" && Boolean(content.trim()) && (guess?.unsure ?? false);
  const kids = loaded?.children ?? [];
  const childChecked = forChild ?? Boolean(guess?.forChild);
  // Same source the family used last time for this category (e.g. insurance paid from savings).
  const lastFromSavings = kind === "expense" && loaded?.bundle.transactions.find((tx) => tx.kind === "expense" && tx.category === category)?.paidFrom === "savings";
  const paidFromSavings = fromSavings ?? lastFromSavings;
  // A payment toward a debt names the debt (guessed from the words, changeable); a typed entry may also answer a waiting fixed item.
  const debts = loaded?.bundle.settings.position?.debts ?? [];
  const isRepayment = kind === "expense" && REPAYMENT_CATEGORIES.includes(category) && debts.length > 0;
  const autoDebt = isRepayment ? autoDebtId({ kind, category, content, debtId: undefined, recurringId: undefined }, debts) ?? "" : "";
  const debtValue = debtChoice ?? autoDebt;
  const answering = loaded && content.trim() ? periodAnswered(loaded.bundle, { content, kind, category, amount: parseVnd(amountText) ?? 0, source: "manual" }) : null;

  function reset() { setDebtChoice(null); setContent(""); setAmountText(""); setKindChoice(null); setPickedCategory(null); setChanging(false); setFromSavings(null); setForChild(null); setError(""); }

  async function save(keepOpen: boolean) {
    if (!loaded || busy) return;
    const built = buildEntry({ content, amountText, kind, category, occurredOn: date, fromSavings: paidFromSavings, forChild: childChecked && kids.length > 0, childId: childId || (kids.length === 1 ? kids[0].id : undefined) });
    if ("error" in built) { setError(built.error); return; }
    const entry = { ...built.entry, debtId: isRepayment && debtValue ? debtValue : undefined };
    setBusy(true); setError("");
    try {
      const { answered } = await saveNewEntry(loaded.bundle, entry);
      // A category the family chose over the guess is remembered for the next entry with the same words.
      if (pickedCategory && kind !== "saving" && pickedCategory !== guess?.category) {
        const categoryMemory = rememberCategory(loaded.bundle.settings.categoryMemory, built.entry.content, pickedCategory);
        if (categoryMemory) await saveMoneySettings({ ...loaded.bundle.settings, categoryMemory });
      }
      trackEvent("money_transaction_saved", { source: "quick_sheet" });
      window.dispatchEvent(new Event(MONEY_CHANGED_EVENT));
      const sign = kind === "income" ? "+" : kind === "saving" ? "→" : "−";
      const undo = () => answered ? undoPeriod(answered.recurringId, answered.period) : deleteMoneyItem("transactions", built.entry.id);
      onSaved(`Đã ghi: ${built.entry.content} ${sign}${vnd(Math.abs(built.entry.amount))} · ${built.entry.category}${answered ? ` · khớp “${answered.name}”, đã đánh dấu ${built.entry.kind === "income" ? "Đã nhận" : "Đã trả"}` : ""}`, () => {
        void undo().then(() => window.dispatchEvent(new Event(MONEY_CHANGED_EVENT))).catch(() => {});
      });
      reset();
      if (keepOpen) { void loadMoney(monthKey(new Date())).then((bundle) => setLoaded((prev) => prev && { ...prev, bundle })).catch(() => {}); textRef.current?.focus({ preventScroll: true }); }
      else onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }

  function trap(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled])")].filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <>
    <div className={`qe-scrim${open ? " show" : ""}`} onClick={onClose} aria-hidden="true" />
    <aside ref={panel} className={`qe-sheet${open ? " show" : ""}`} role="dialog" aria-modal="true" aria-labelledby="qe-title" inert={!open} onKeyDown={trap}>
      <h2 id="qe-title">Ghi khoản <button type="button" className="qe-x" aria-label="Đóng" onClick={onClose}>✕</button></h2>
      <div className="qe-seg" role="group" aria-label="Loại">
        {KINDS.map((item) => <button key={item} type="button" className={kind === item ? "on" : undefined} aria-pressed={kind === item} onClick={() => { setKindChoice(item); setPickedCategory(null); }}>{MONEY_KIND_LABELS[item]}</button>)}
      </div>
      <div className="qe-field"><label htmlFor="qe-content">Nội dung</label>
        <input id="qe-content" ref={textRef} value={content} maxLength={120} placeholder="Ăn sáng, tiền điện, lương…" autoComplete="off" onChange={(event) => { setContent(event.target.value); if (!event.target.value) setPickedCategory(null); }} onKeyDown={(event) => { if (event.key === "Enter") void save(false); }} /></div>
      <div className="qe-field"><label htmlFor="qe-amount">Số tiền</label>
        <AmountInput id="qe-amount" value={amountText} placeholder={kind === "saving" ? "5tr, hoặc -698k khi rút" : "350k hoặc 1,5tr"} onChange={(event) => setAmountText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(false); }} /></div>
      <div className="qe-guess" aria-live="polite">
        {content.trim() || kind === "saving"
          ? <>Nhóm: <span className={`qe-cat${unsure ? " unsure" : ""}`}>{category}{unsure ? " ?" : ""}</span>
            <button type="button" onClick={() => setChanging(!changing)} aria-expanded={changing}>Đổi</button>
            {unsure && <span>Chưa chắc — kiểm tra lại</span>}
            {changing && <select aria-label="Nhóm" value={category} onChange={(event) => { setPickedCategory(event.target.value); setChanging(false); }}>{options.map((name) => <option key={name}>{name}</option>)}</select>}</>
          : <>Nhóm sẽ tự chọn khi bạn gõ nội dung.</>}
      </div>
      {answering && <p className="qe-match">Khớp khoản cố định “{answering.name}” ({answering.label}) → sẽ đánh dấu {answering.kind === "income" ? "Đã nhận" : "Đã trả"}, không tạo trùng.</p>}
      {isRepayment && <div className="qe-field"><label htmlFor="qe-debt">Trả cho khoản nợ nào?</label>
        <select id="qe-debt" value={debtValue} onChange={(event) => setDebtChoice(event.target.value)}>{debts.map((debt) => <option key={debt.id} value={debt.id}>{debt.name}</option>)}<option value="">Khoản khác (không trừ nợ nào)</option></select></div>}
      <details className="qe-more">
        <summary>Thêm chi tiết</summary>
        <div className="qe-more-grid">
          <div className="qe-field"><label htmlFor="qe-date">Ngày <span>({formatVnDate(date)})</span></label><DateInput aria-label="Ngày" value={date} onChange={setDate} /></div>
          {kind === "expense" && <div className="qe-field"><label htmlFor="qe-from">Trả từ</label>
            <select id="qe-from" value={paidFromSavings ? "savings" : "cash"} onChange={(event) => setFromSavings(event.target.value === "savings")}><option value="cash">Tiền tiêu</option><option value="savings">Quỹ tiết kiệm</option></select></div>}
          {kids.length > 0 && <label className="qe-check"><input type="checkbox" checked={childChecked} onChange={(event) => setForChild(event.target.checked)} /> Chi cho con</label>}
          {kids.length > 1 && childChecked && <div className="qe-field"><label htmlFor="qe-child">Cho bé</label>
            <select id="qe-child" value={childId || kids[0].id} onChange={(event) => setChildId(event.target.value)}>{kids.map((child) => <option key={child.id} value={child.id}>{child.name || "Bé"}</option>)}</select></div>}
        </div>
      </details>
      {error && <p className="qe-error" role="alert">{error}</p>}
      <div className="qe-actions">
        <button type="button" className="qe-btn ghost" disabled={busy || !loaded} onClick={() => void save(true)}>Ghi &amp; nhập tiếp</button>
        <button type="button" className="qe-btn primary" disabled={busy || !loaded} onClick={() => void save(false)}>{busy ? "Đang ghi…" : "Ghi"}</button>
      </div>
    </aside>
  </>;
}
