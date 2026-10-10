"use client";

// Tab Đồ đạc: the packing checklist grouped by category, with the "Gợi ý theo nhà mình" dialog — suggestions
// (rule template, plus an AI pass for destination-specific items) always pass a confirm list before anything
// is added (plan 261010-1335 acceptance #3, Đợt 5).
import { useEffect, useMemo, useState } from "react";
import { cloudEnabled } from "@/lib/experience/cloud";
import { suggestPacking, type PackingSuggestion } from "@/lib/travel/packing-template";
import { memberLabel, type TripMember } from "@/lib/travel/trip-members";
import { tripNights } from "@/lib/travel/trip-state";
import { DEST_TYPE_LABELS, PACKING_CATEGORIES, PACKING_CATEGORY_LABELS, type PackingCategory, type PackingItem, type Trip } from "@/lib/travel/types";

function SuggestSheet({ trip, items, members, aiConsent, onAdd, onClose }: { trip: Trip; items: PackingItem[]; members: TripMember[]; aiConsent: boolean; onAdd: (items: PackingItem[]) => void; onClose: () => void }) {
  const suggestions = useMemo(() => suggestPacking({ destType: trip.destType, nights: tripNights(trip), members, existing: items }), [trip, members, items]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(suggestions.map((_, index) => index)));
  // Destination-specific items the model added (Đợt 5): same confirm list, marked with ✨ and source "ai".
  const [extras, setExtras] = useState<PackingSuggestion[]>([]);
  const [aiState, setAiState] = useState<"idle" | "busy" | "done">("idle");
  const [aiError, setAiError] = useState("");
  const [aiAvailable, setAiAvailable] = useState(false);
  // Only offer the AI pass when the server actually has a model configured (no dead button).
  useEffect(() => {
    if (!cloudEnabled || !aiConsent) return;
    fetch("/api/travel/suggest", { cache: "no-store" }).then((response) => response.json()).then((data: { available?: boolean }) => setAiAvailable(data.available === true)).catch(() => {});
  }, [aiConsent]);
  const children = members.filter((member) => member.kind === "child");
  const combined = useMemo(() => [...suggestions, ...extras], [suggestions, extras]);
  const byCategory = PACKING_CATEGORIES.map((category) => ({ category, list: combined.map((suggestion, index) => ({ suggestion, index })).filter(({ suggestion }) => suggestion.category === category) })).filter(({ list }) => list.length);

  async function askAi() {
    setAiState("busy"); setAiError("");
    try {
      const response = await fetch("/api/travel/suggest", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trip.destination, destType: trip.destType, nights: tripNights(trip),
          childAges: children.map((child) => child.ageMonths === undefined ? "bé 36 tháng" : child.ageMonths < 24 ? `bé ${child.ageMonths} tháng` : `bé ${Math.floor(child.ageMonths / 12)} tuổi`),
          adults: Math.max(1, members.length - children.length),
          existing: [...items.map((item) => item.name), ...combined.map((suggestion) => suggestion.name)].slice(0, 120),
          aiConsent,
        }),
      });
      const data = await response.json().catch(() => ({})) as { items?: PackingSuggestion[]; error?: string };
      if (!response.ok) throw new Error(data.error || "AI chưa gợi ý được lúc này.");
      const fresh = (data.items ?? []).slice(0, 15);
      setExtras((previous) => [...previous, ...fresh]);
      // New AI items arrive pre-checked, right behind the template ones.
      setPicked((previous) => { const next = new Set(previous); fresh.forEach((_, offset) => next.add(combined.length + offset)); return next; });
      setAiState("done");
      if (!fresh.length) setAiError("AI không thấy món nào còn thiếu — checklist đã khá đủ.");
    } catch (failure) { setAiState("idle"); setAiError((failure as Error).message); }
  }

  function confirm() {
    onAdd(combined.flatMap((suggestion, index) => picked.has(index)
      ? [{ id: crypto.randomUUID(), tripId: trip.id, name: suggestion.name.slice(0, 80), qty: suggestion.qty, category: suggestion.category, memberId: suggestion.memberId, status: "todo", source: index >= suggestions.length ? "ai" : "template" } satisfies PackingItem]
      : []));
    onClose();
  }

  return <>
    <div className="tv-scrim" onClick={onClose} />
    <div className="tv-sheet" role="dialog" aria-modal="true" aria-label="Gợi ý đồ theo nhà mình">
      <button type="button" className="tv-sheet-x" onClick={onClose} aria-label="Đóng">✕</button>
      <h3>✨ Gợi ý theo nhà mình</h3>
      <p className="tv-hint">{children.length ? `Từ hồ sơ: ${children.map((child) => child.label).join(", ")} × ` : "Từ "}{tripNights(trip)} đêm × {DEST_TYPE_LABELS[trip.destType].label.toLowerCase()}. Bỏ chọn món không cần — <b>chỉ thêm khi bạn xác nhận</b>.</p>
      {combined.length === 0 && <p className="tv-muted">Checklist đã có đủ các món thường gặp — không còn gì để gợi ý thêm.</p>}
      <div className="tv-suggest-list">
        {byCategory.map(({ category, list }) => <div key={category}>
          <h5>{PACKING_CATEGORY_LABELS[category]}</h5>
          {list.map(({ suggestion, index }) => <label key={index} className="tv-suggest">
            <input type="checkbox" checked={picked.has(index)} onChange={() => setPicked((previous) => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; })} />
            <span>{suggestion.name}{suggestion.qty > 1 ? ` ×${suggestion.qty}` : ""}{index >= suggestions.length && <em className="tv-ai-mark" title="Do AI gợi ý">✨</em>}</span>
          </label>)}
        </div>)}
      </div>
      {aiAvailable && aiState !== "done" && <button type="button" className="tv-btn tv-btn-ghost tv-btn-block" onClick={askAi} disabled={aiState === "busy"}>{aiState === "busy" ? "AI đang nghĩ…" : `✨ Nhờ AI gợi ý thêm cho ${trip.destination}`}</button>}
      {aiError && <p className="tv-hint tv-warn-text" role="alert">{aiError}</p>}
      {combined.length > 0 && <button type="button" className="tv-btn tv-btn-primary tv-btn-block" onClick={confirm} disabled={picked.size === 0}>Thêm {picked.size} món đã chọn vào checklist</button>}
    </div>
  </>;
}

export function TripPacking({ trip, items, members, aiConsent, copySource, onSave, onSaveMany, onDelete }: {
  trip: Trip; items: PackingItem[]; members: TripMember[]; aiConsent: boolean;
  /** The newest other trip that has a checklist — its list doubles as the family's template (Đợt 5). */
  copySource?: { name: string; items: PackingItem[] };
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
    {items.length === 0 && copySource && <button type="button" className="tv-btn tv-btn-ghost tv-btn-block" onClick={() => onSaveMany(copySource.items.map((item) => ({ ...item, id: crypto.randomUUID(), tripId: trip.id, status: "todo" as const })))}>
      📋 Chép checklist từ chuyến &quot;{copySource.name}&quot; ({copySource.items.length} món)
    </button>}

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

    {suggesting && <SuggestSheet trip={trip} items={items} members={members} aiConsent={aiConsent} onAdd={onSaveMany} onClose={() => setSuggesting(false)} />}
  </section>;
}
