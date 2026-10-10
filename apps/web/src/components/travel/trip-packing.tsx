"use client";

// Tab Đồ đạc: the packing checklist grouped by category, with the "Gợi ý theo nhà mình" dialog — suggestions
// always pass a confirm list before anything is added (plan 261010-1335 acceptance #3).
import { useMemo, useState } from "react";
import { suggestPacking } from "@/lib/travel/packing-template";
import { memberLabel, type TripMember } from "@/lib/travel/trip-members";
import { tripNights } from "@/lib/travel/trip-state";
import { DEST_TYPE_LABELS, PACKING_CATEGORIES, PACKING_CATEGORY_LABELS, type PackingCategory, type PackingItem, type Trip } from "@/lib/travel/types";

function SuggestSheet({ trip, items, members, onAdd, onClose }: { trip: Trip; items: PackingItem[]; members: TripMember[]; onAdd: (items: PackingItem[]) => void; onClose: () => void }) {
  const suggestions = useMemo(() => suggestPacking({ destType: trip.destType, nights: tripNights(trip), members, existing: items }), [trip, members, items]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(suggestions.map((_, index) => index)));
  const children = members.filter((member) => member.kind === "child");
  const byCategory = PACKING_CATEGORIES.map((category) => ({ category, list: suggestions.map((suggestion, index) => ({ suggestion, index })).filter(({ suggestion }) => suggestion.category === category) })).filter(({ list }) => list.length);

  function confirm() {
    const chosen = suggestions.filter((_, index) => picked.has(index));
    onAdd(chosen.map((suggestion) => ({ id: crypto.randomUUID(), tripId: trip.id, name: suggestion.name.slice(0, 80), qty: suggestion.qty, category: suggestion.category, memberId: suggestion.memberId, status: "todo", source: "template" } satisfies PackingItem)));
    onClose();
  }

  return <>
    <div className="tv-scrim" onClick={onClose} />
    <div className="tv-sheet" role="dialog" aria-modal="true" aria-label="Gợi ý đồ theo nhà mình">
      <button type="button" className="tv-sheet-x" onClick={onClose} aria-label="Đóng">✕</button>
      <h3>✨ Gợi ý theo nhà mình</h3>
      <p className="tv-hint">{children.length ? `Từ hồ sơ: ${children.map((child) => child.label).join(", ")} × ` : "Từ "}{tripNights(trip)} đêm × {DEST_TYPE_LABELS[trip.destType].label.toLowerCase()}. Bỏ chọn món không cần — <b>chỉ thêm khi bạn xác nhận</b>.</p>
      {suggestions.length === 0 && <p className="tv-muted">Checklist đã có đủ các món thường gặp — không còn gì để gợi ý thêm.</p>}
      <div className="tv-suggest-list">
        {byCategory.map(({ category, list }) => <div key={category}>
          <h5>{PACKING_CATEGORY_LABELS[category]}</h5>
          {list.map(({ suggestion, index }) => <label key={index} className="tv-suggest">
            <input type="checkbox" checked={picked.has(index)} onChange={() => setPicked((previous) => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; })} />
            <span>{suggestion.name}{suggestion.qty > 1 ? ` ×${suggestion.qty}` : ""}</span>
          </label>)}
        </div>)}
      </div>
      {suggestions.length > 0 && <button type="button" className="tv-btn tv-btn-primary tv-btn-block" onClick={confirm} disabled={picked.size === 0}>Thêm {picked.size} món đã chọn vào checklist</button>}
    </div>
  </>;
}

export function TripPacking({ trip, items, members, onSave, onSaveMany, onDelete }: {
  trip: Trip; items: PackingItem[]; members: TripMember[];
  onSave: (item: PackingItem) => void; onSaveMany: (items: PackingItem[]) => void; onDelete: (id: string) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PackingCategory>("other");
  const packed = items.filter((item) => item.status === "packed").length;
  const pct = items.length ? Math.round((packed / items.length) * 100) : 0;

  function addManual() {
    if (!name.trim()) return;
    onSave({ id: crypto.randomUUID(), tripId: trip.id, name: name.trim().slice(0, 80), qty: 1, category, memberId: undefined, status: "todo", source: "manual" });
    setName("");
  }

  return <section className="tv-card tv-panel">
    <div className="tv-pack-top">
      <b>{packed}/{items.length} đã xếp</b>
      <div className="tv-bar"><i style={{ width: `${pct}%` }} /></div>
      <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={() => setSuggesting(true)}>✨ Gợi ý theo nhà mình</button>
    </div>
    <p className="tv-hint">Gợi ý sinh từ hồ sơ gia đình (tuổi các bé) × số đêm × kiểu chuyến — luôn hỏi trước khi thêm.</p>

    {PACKING_CATEGORIES.map((group) => {
      const list = items.filter((item) => item.category === group);
      if (!list.length) return null;
      return <div key={group} className="tv-pack-group">
        <h4>{PACKING_CATEGORY_LABELS[group]}</h4>
        {list.map((item) => <div key={item.id} className={`tv-pack ${item.status === "packed" ? "packed" : ""}`}>
          <button type="button" className={`tv-tick ${item.status === "packed" ? "on" : ""}`} aria-pressed={item.status === "packed"} aria-label={`${item.name}: ${item.status === "packed" ? "đã xếp" : "chưa xếp"}`} onClick={() => onSave({ ...item, status: item.status === "packed" ? "todo" : "packed" })}>{item.status === "packed" ? "✓" : ""}</button>
          <span className="tv-pack-name">{item.name}{item.qty > 1 && <small> · ×{item.qty}</small>}</span>
          {item.memberId && <span className="tv-who">{memberLabel(members, item.memberId)}</span>}
          <button type="button" className={`tv-buy ${item.status === "buy_there" ? "on" : ""}`} aria-pressed={item.status === "buy_there"} onClick={() => onSave({ ...item, status: item.status === "buy_there" ? "todo" : "buy_there" })}>mua tại chỗ</button>
          <button type="button" className="tv-x" onClick={() => onDelete(item.id)} aria-label={`Xoá ${item.name}`}>🗑</button>
        </div>)}
      </div>;
    })}

    <div className="tv-pack-add">
      <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addManual(); }} placeholder="Thêm món đồ… (vd: máy hâm sữa)" maxLength={80} />
      <select value={category} onChange={(event) => setCategory(event.target.value as PackingCategory)} aria-label="Nhóm đồ">
        {PACKING_CATEGORIES.map((group) => <option key={group} value={group}>{PACKING_CATEGORY_LABELS[group]}</option>)}
      </select>
      <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={addManual}>Thêm</button>
    </div>

    {suggesting && <SuggestSheet trip={trip} items={items} members={members} onAdd={onSaveMany} onClose={() => setSuggesting(false)} />}
  </section>;
}
