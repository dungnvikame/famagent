"use client";

// Tab Lịch trình: one block per day of the trip, entries ordered by position; entries whose day fell outside a
// changed date range wait in "chưa xếp ngày" instead of disappearing (plan 261010-1335 acceptance #2).
import { useState } from "react";
import { vndCompact } from "@/lib/money/format-vnd";
import { groupAmountTyping, parseVnd } from "@/lib/money/parse";
import { tripDays } from "@/lib/travel/trip-state";
import type { ItineraryEntry, Trip } from "@/lib/travel/types";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const dayLabel = (iso: string) => `${WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function EntryForm({ tripId, dayDate, position, entry, onSave, onClose }: { tripId: string; dayDate?: string; position: number; entry?: ItineraryEntry; onSave: (entry: ItineraryEntry) => void; onClose: () => void }) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [timeLabel, setTimeLabel] = useState(entry?.timeLabel ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [cost, setCost] = useState(entry?.estAmount ? groupAmountTyping(String(entry.estAmount)) : "");
  const [url, setUrl] = useState(entry?.url ?? "");

  function submit() {
    if (!title.trim()) return;
    const estAmount = cost.trim() ? parseVnd(cost) : 0;
    const link = url.trim();
    onSave({
      id: entry?.id ?? crypto.randomUUID(), tripId, dayDate: entry ? entry.dayDate : dayDate, position: entry?.position ?? position,
      timeLabel: timeLabel.trim() ? timeLabel.trim().slice(0, 20) : undefined, title: title.trim().slice(0, 120),
      note: note.trim() ? note.trim().slice(0, 500) : undefined, url: /^https?:\/\//i.test(link) ? link.slice(0, 500) : undefined,
      estAmount: estAmount && estAmount > 0 ? estAmount : 0,
    });
    onClose();
  }

  return <div className="tv-entry-form">
    <div className="tv-entry-row">
      <input className="tv-in-time" value={timeLabel} onChange={(event) => setTimeLabel(event.target.value)} placeholder="08:00" maxLength={20} aria-label="Giờ" />
      <input className="tv-in-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hoạt động… (vd: Bà Nà Hills)" maxLength={120} autoFocus aria-label="Tên hoạt động" />
      <input className="tv-in-cost" inputMode="numeric" value={cost} onChange={(event) => setCost(groupAmountTyping(event.target.value))} placeholder="Chi phí dự kiến" aria-label="Chi phí dự kiến" />
    </div>
    <div className="tv-entry-row">
      <input className="tv-in-title" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú (tuỳ chọn)" maxLength={500} aria-label="Ghi chú" />
      <input className="tv-in-title" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https:// (tuỳ chọn)" inputMode="url" aria-label="Link" />
    </div>
    <div className="tv-entry-row">
      <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={submit}>{entry ? "Lưu" : "Thêm"}</button>
      <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={onClose}>Thôi</button>
    </div>
  </div>;
}

export function TripItinerary({ trip, entries, onSave, onDelete }: { trip: Trip; entries: ItineraryEntry[]; onSave: (entry: ItineraryEntry) => void; onDelete: (id: string) => void }) {
  const [adding, setAdding] = useState<string | "unscheduled" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const days = tripDays(trip);
  const daySet = new Set(days);
  const byDay = (day: string) => entries.filter((entry) => entry.dayDate === day).sort((a, b) => a.position - b.position || (a.timeLabel ?? "").localeCompare(b.timeLabel ?? ""));
  const unscheduled = entries.filter((entry) => !entry.dayDate || !daySet.has(entry.dayDate));
  const nextPosition = (day?: string) => entries.filter((entry) => entry.dayDate === day).reduce((max, entry) => Math.max(max, entry.position), -1) + 1;

  const row = (entry: ItineraryEntry) => editingId === entry.id
    ? <EntryForm key={entry.id} tripId={trip.id} position={entry.position} entry={entry} onSave={onSave} onClose={() => setEditingId(null)} />
    : <div key={entry.id} className="tv-it">
      {entry.timeLabel && <span className="tv-it-time">{entry.timeLabel}</span>}
      <div className="tv-it-body">
        <b>{entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title} ↗</a> : entry.title}</b>
        {entry.note && <small>{entry.note}</small>}
      </div>
      {entry.estAmount > 0 && <span className="tv-it-cost">~{vndCompact(entry.estAmount)}</span>}
      <select className="tv-it-move" value={entry.dayDate && daySet.has(entry.dayDate) ? entry.dayDate : ""} aria-label="Chuyển ngày" onChange={(event) => onSave({ ...entry, dayDate: event.target.value || undefined, position: nextPosition(event.target.value || undefined) })}>
        <option value="">Chưa xếp</option>
        {days.map((day, index) => <option key={day} value={day}>Ngày {index + 1}</option>)}
      </select>
      <button type="button" className="tv-x" onClick={() => setEditingId(entry.id)} aria-label={`Sửa ${entry.title}`}>✎</button>
      <button type="button" className="tv-x" onClick={() => onDelete(entry.id)} aria-label={`Xoá ${entry.title}`}>🗑</button>
    </div>;

  return <section className="tv-card tv-panel">
    <div className="tv-days">
      {days.map((day, index) => {
        const list = byDay(day);
        return <div key={day} className="tv-day">
          <h4>Ngày {index + 1} <small className="tv-muted">· {dayLabel(day)}</small>{list.length === 0 && <em className="tv-pill tv-pill-warn tv-pill-xs">trống</em>}</h4>
          {list.map(row)}
          {adding === day
            ? <EntryForm tripId={trip.id} dayDate={day} position={nextPosition(day)} onSave={onSave} onClose={() => setAdding(null)} />
            : <button type="button" className="tv-add-entry" onClick={() => { setAdding(day); setEditingId(null); }}>＋ Thêm hoạt động</button>}
        </div>;
      })}
    </div>
    {(unscheduled.length > 0 || adding === "unscheduled") && <div className="tv-unsched">
      <b>💡 Chưa xếp ngày</b>
      <p className="tv-hint">Đổi ngày đi–về không làm mất hoạt động — chúng nằm ở đây chờ xếp lại.</p>
      {unscheduled.map(row)}
      {adding === "unscheduled" && <EntryForm tripId={trip.id} position={nextPosition(undefined)} onSave={onSave} onClose={() => setAdding(null)} />}
    </div>}
    {adding !== "unscheduled" && <button type="button" className="tv-link tv-small" onClick={() => { setAdding("unscheduled"); setEditingId(null); }}>＋ Thêm ý tưởng chưa chốt ngày</button>}
  </section>;
}
