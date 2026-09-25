"use client";

import { useMemo, useState } from "react";
import { vnd } from "@/lib/catalog/format";
import { isFiltering, monthRange, parseFilterQuery, PRESET_LABELS, presetOf, presetRange, type LedgerFilter } from "@/lib/money/ledger-filter";
import { formatVnDate, parseVnd } from "@/lib/money/parse";
import { MONEY_KIND_LABELS, SAVING_CATEGORIES, type MoneyCategory, type MoneyKind, type MoneyTransaction } from "@/lib/money/types";
import { AmountInput } from "./amount-input";
import { DateInput } from "./date-input";
import { FilterDropdown } from "./filter-dropdown";

interface Props {
  filter: LedgerFilter;
  onChange: (filter: LedgerFilter) => void;
  month: string;
  today: string;
  categories: MoneyCategory[];
  /** Entries in the current date range (before the other filters), for counts and shares. */
  inRange: MoneyTransaction[];
  /** Entries shown after every filter. */
  shown: MoneyTransaction[];
  loading?: boolean;
  /** One comparison sentence from the parent (e.g. vs. the 3-month average), shown in the summary strip. */
  insight?: string;
}

const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const rangeLabel = (from: string, to: string, today: string) => { const preset = presetOf(from, to, today); const label = preset ? PRESET_LABELS.find(([key]) => key === preset)![1] : ""; return from === to ? formatVnDate(from) : `${label ? `${label} · ` : ""}${short(from)} – ${short(to)}`; };
const CalendarIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;

/** Category dropdown: search, several at once, entries and total per category in the current range. */
function CategoryPicker({ filter, onChange, categories, inRange, close }: { filter: LedgerFilter; onChange: Props["onChange"]; categories: MoneyCategory[]; inRange: MoneyTransaction[]; close: () => void }) {
  const [picked, setPicked] = useState<string[]>(filter.categories);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const stats = useMemo(() => { const map = new Map<string, { count: number; total: number }>(); for (const tx of inRange) { const row = map.get(tx.category) ?? { count: 0, total: 0 }; row.count += 1; row.total += Math.abs(tx.amount); map.set(tx.category, row); } return map; }, [inRange]);
  const names = [...new Set([...categories.filter((item) => !item.archived).map((item) => item.name), ...SAVING_CATEGORIES, ...stats.keys()])];
  const match = (name: string) => !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
  const used = names.filter((name) => stats.has(name) && match(name)).sort((a, b) => stats.get(b)!.total - stats.get(a)!.total);
  const unused = names.filter((name) => !stats.has(name) && match(name));
  const row = (name: string) => <label key={name}><input type="checkbox" checked={picked.includes(name)} onChange={(event) => setPicked(event.target.checked ? [...picked, name] : picked.filter((item) => item !== name))} /> {name}{stats.has(name) && <em>{stats.get(name)!.count} khoản · {vnd(stats.get(name)!.total)}</em>}</label>;
  return <>
    <input className="dd-search" placeholder="Tìm nhóm…" value={query} autoFocus onChange={(event) => setQuery(event.target.value)} />
    <div className="dd-list">{used.map(row)}{(showAll || query.trim()) && unused.map(row)}</div>
    {!showAll && !query.trim() && unused.length > 0 && <button type="button" className="dd-more" onClick={() => setShowAll(true)}>+ {unused.length} nhóm chưa có khoản trong khoảng này</button>}
    <div className="dd-foot"><button type="button" className="ledger-link" onClick={() => setPicked([])}>Bỏ chọn hết</button><button type="button" className="app-btn" onClick={() => { onChange({ ...filter, categories: picked }); close(); }}>Áp dụng</button></div>
  </>;
}

/** Date range: presets, from/to fields (dd/mm/yyyy) and a month calendar (first click = from, second = to). */
function RangePicker({ filter, onChange, month, today, close }: { filter: LedgerFilter; onChange: Props["onChange"]; month: string; today: string; close: () => void }) {
  const [from, setFrom] = useState(filter.from);
  const [to, setTo] = useState(filter.to);
  const [picking, setPicking] = useState<"from" | "to">("from");
  const [view, setView] = useState(filter.from.slice(0, 7));
  const [y, m] = view.split("-").map(Number);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7; const days = new Date(y, m, 0).getDate();
  const shiftView = (delta: number) => { const d = new Date(y, m - 1 + delta, 1); setView(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  function pick(day: string) {
    if (picking === "from") { setFrom(day); setTo(day); setPicking("to"); }
    else { if (day < from) { setTo(from); setFrom(day); } else setTo(day); setPicking("from"); }
  }
  return <>
    <div className="presets">{PRESET_LABELS.map(([key, label]) => { const range = presetRange(key, today); return <button type="button" key={key} className={range.from === from && range.to === to ? "on" : undefined} onClick={() => { setFrom(range.from); setTo(range.to); setView(range.from.slice(0, 7)); setPicking("from"); }}>{label}</button>; })}</div>
    <div className="range-main">
      <div className="range-fields"><label>Từ ngày<DateInput aria-label="Từ ngày" value={from} onChange={(value) => { setFrom(value); if (value > to) setTo(value); setView(value.slice(0, 7)); }} /></label><label>Đến ngày<DateInput aria-label="Đến ngày" value={to} onChange={(value) => { setTo(value); if (value < from) setFrom(value); }} /></label></div>
      <div className="cal">
        <div className="cal-head"><button type="button" aria-label="Tháng trước" onClick={() => shiftView(-1)}>‹</button><b>Tháng {m}/{y}</b><button type="button" aria-label="Tháng sau" onClick={() => shiftView(1)}>›</button></div>
        <div className="cal-grid">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((dow) => <span key={dow} className="dow">{dow}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => { const day = `${view}-${String(i + 1).padStart(2, "0")}`; const cls = day === from || day === to ? "edge" : day > from && day < to ? "in" : day === today ? "today" : ""; return <button type="button" key={day} className={cls} onClick={() => pick(day)}>{i + 1}</button>; })}
        </div>
        <small className="cal-hint">{picking === "to" ? "Chọn ngày kết thúc" : "Chọn ngày bắt đầu"}</small>
      </div>
    </div>
    <div className="dd-foot"><button type="button" className="ledger-link" onClick={() => { const range = monthRange(month); setFrom(range.from); setTo(range.to); setView(month); }}>Về cả tháng đang xem</button><button type="button" className="app-btn" onClick={() => { onChange({ ...filter, from, to }); close(); }}>Áp dụng</button></div>
  </>;
}

/** Child / monthly flags and an amount range. */
function MoreFilters({ filter, onChange, close }: { filter: LedgerFilter; onChange: Props["onChange"]; close: () => void }) {
  const [forChild, setForChild] = useState(Boolean(filter.forChild));
  const [monthly, setMonthly] = useState(Boolean(filter.monthly));
  const [min, setMin] = useState(filter.min ? filter.min.toLocaleString("vi-VN") : "");
  const [max, setMax] = useState(filter.max ? filter.max.toLocaleString("vi-VN") : "");
  return <>
    <label><input type="checkbox" checked={forChild} onChange={(event) => setForChild(event.target.checked)} /> Chỉ khoản cho con</label>
    <label><input type="checkbox" checked={monthly} onChange={(event) => setMonthly(event.target.checked)} /> Chỉ khoản ↻ hằng tháng</label>
    <div className="amt"><span>Số tiền</span><span className="amt-row">từ <AmountInput aria-label="Số tiền từ" placeholder="0" value={min} onChange={(event) => setMin(event.target.value)} /> đến <AmountInput aria-label="Số tiền đến" placeholder="không giới hạn" value={max} onChange={(event) => setMax(event.target.value)} /></span></div>
    <div className="dd-foot"><button type="button" className="ledger-link" onClick={() => { setForChild(false); setMonthly(false); setMin(""); setMax(""); }}>Bỏ lọc</button>
      <button type="button" className="app-btn" onClick={() => { const lo = min.trim() ? parseVnd(min) : null; const hi = max.trim() ? parseVnd(max) : null; onChange({ ...filter, forChild: forChild || undefined, monthly: monthly || undefined, min: lo ? Math.abs(lo) : undefined, max: hi ? Math.abs(hi) : undefined }); close(); }}>Áp dụng</button></div>
  </>;
}

/**
 * Sổ filter bar: a smart box that turns a sentence into filters, then Loại · Nhóm · Khoảng ngày · Lọc khác, and a
 * summary of what is shown. Filters only read the entries on this device; nothing is sent anywhere.
 */
export function LedgerFilters({ filter, onChange, month, today, categories, inRange, shown, loading, insight }: Props) {
  const [open, setOpen] = useState<"cat" | "range" | "more" | null>(null);
  const [query, setQuery] = useState("");
  const range = monthRange(month);
  const names = [...new Set([...categories.map((item) => item.name), ...SAVING_CATEGORIES])];
  const toggle = (which: typeof open) => (next: boolean) => setOpen(next ? which : null);

  function submitQuery() {
    if (!query.trim()) return;
    const { patch, text } = parseFilterQuery(query, names, today);
    onChange({ ...filter, ...patch, categories: patch.categories ? [...new Set([...filter.categories, ...patch.categories])] : filter.categories, text: [filter.text, text].filter(Boolean).join(" ").trim() });
    setQuery("");
  }

  const tokens: Array<{ key: string; label: string; clear: () => void }> = [
    ...filter.categories.map((name) => ({ key: `c:${name}`, label: `Nhóm: ${name}`, clear: () => onChange({ ...filter, categories: filter.categories.filter((item) => item !== name) }) })),
    ...(filter.from !== range.from || filter.to !== range.to ? [{ key: "range", label: rangeLabel(filter.from, filter.to, today), clear: () => onChange({ ...filter, ...range }) }] : []),
    ...(filter.min !== undefined ? [{ key: "min", label: `Từ ${vnd(filter.min)}`, clear: () => onChange({ ...filter, min: undefined }) }] : []),
    ...(filter.max !== undefined ? [{ key: "max", label: `Đến ${vnd(filter.max)}`, clear: () => onChange({ ...filter, max: undefined }) }] : []),
    ...(filter.forChild ? [{ key: "child", label: "Cho con", clear: () => onChange({ ...filter, forChild: undefined }) }] : []),
    ...(filter.monthly ? [{ key: "monthly", label: "↻ Hằng tháng", clear: () => onChange({ ...filter, monthly: undefined }) }] : []),
    ...(filter.text ? [{ key: "text", label: `Có chữ “${filter.text}”`, clear: () => onChange({ ...filter, text: "" }) }] : []),
  ];

  const sum = (list: MoneyTransaction[], kind: MoneyKind) => list.filter((tx) => tx.kind === kind).reduce((total, tx) => total + tx.amount, 0);
  const shownExpense = sum(shown, "expense"); const rangeExpense = sum(inRange, "expense");
  const parts = (["expense", "income", "saving"] as MoneyKind[]).filter((kind) => sum(shown, kind)).map((kind) => `${MONEY_KIND_LABELS[kind]} ${vnd(sum(shown, kind))}`);
  const filtering = isFiltering(filter, month);

  return <section className="app-card filter-card" aria-label="Bộ lọc sổ thu chi">
    <div className="smart">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      {tokens.map((token) => <span key={token.key} className="tok">{token.label}<button type="button" aria-label={`Bỏ lọc ${token.label}`} onClick={token.clear}>×</button></span>)}
      <input aria-label="Gõ để lọc" placeholder={tokens.length ? "Thêm điều kiện…" : "Gõ để lọc: “ăn uống tuần này trên 200k”, “cho con”, “grab”… rồi Enter"} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitQuery(); if (event.key === "Backspace" && !query && tokens.length) tokens[tokens.length - 1].clear(); }} />
    </div>
    <div className="frow">
      <span className="seg" role="group" aria-label="Loại">
        <button type="button" className={!filter.kinds.length ? "on" : undefined} onClick={() => onChange({ ...filter, kinds: [] })}>Tất cả</button>
        {(["expense", "income", "saving"] as MoneyKind[]).map((kind) => <button type="button" key={kind} className={filter.kinds.length === 1 && filter.kinds[0] === kind ? "on" : undefined} onClick={() => onChange({ ...filter, kinds: [kind] })}>{MONEY_KIND_LABELS[kind]}</button>)}
      </span>
      <FilterDropdown open={open === "cat"} onOpenChange={toggle("cat")} active={filter.categories.length > 0} label={<><span className="dd-k">Nhóm</span> {filter.categories.length ? filter.categories.length === 1 ? filter.categories[0] : `${filter.categories[0]} +${filter.categories.length - 1}` : "Tất cả"} ▾</>}>
        <CategoryPicker filter={filter} onChange={onChange} categories={categories} inRange={inRange} close={() => setOpen(null)} />
      </FilterDropdown>
      <FilterDropdown className="range-dd" align="center" open={open === "range"} onOpenChange={toggle("range")} active={filter.from !== range.from || filter.to !== range.to} label={<><CalendarIcon /> {formatVnDate(filter.from)} – {formatVnDate(filter.to)} ▾</>}>
        <RangePicker filter={filter} onChange={onChange} month={month} today={today} close={() => setOpen(null)} />
      </FilterDropdown>
      <FilterDropdown open={open === "more"} onOpenChange={toggle("more")} active={Boolean(filter.forChild || filter.monthly || filter.min !== undefined || filter.max !== undefined)} label={<>Lọc khác ▾</>}>
        <MoreFilters filter={filter} onChange={onChange} close={() => setOpen(null)} />
      </FilterDropdown>
    </div>
    <div className="fsum" role="status">
      <span>{loading ? "Đang tải các khoản…" : <><b>{shown.length} khoản</b>{parts.length ? ` · ${parts.join(" · ")}` : ""}{filtering && shownExpense && rangeExpense && shownExpense !== rangeExpense ? ` · ${Math.round(shownExpense / rangeExpense * 100)}% tổng chi trong khoảng này` : ""}</>}</span>
      <span className="hint">{insight}{insight && filtering ? " · " : ""}{filtering && <button type="button" className="ledger-link" onClick={() => onChange({ kinds: [], categories: [], ...range, text: "" })}>Xóa lọc</button>}</span>
    </div>
  </section>;
}
