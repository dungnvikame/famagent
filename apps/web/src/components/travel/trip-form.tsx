"use client";

// Create/edit one trip in a bottom sheet: 5 fields, ~1 minute (plan 261010-1335 §4.2). Editing adds status + delete.
import { useEffect, useMemo, useState } from "react";
import { groupAmountTyping, parseVnd, todayLocal } from "@/lib/money/parse";
import { vndCompact } from "@/lib/money/format-vnd";
import { suggestTripName } from "@/lib/travel/trip-state";
import { DEST_TYPES, DEST_TYPE_LABELS, type DestType, type Trip } from "@/lib/travel/types";

const plusDays = (day: string, days: number) => { const date = new Date(`${day}T00:00:00`); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

export function TripForm({ trip, onSave, onDelete, onClose }: { trip?: Trip; onSave: (trip: Trip) => void; onDelete?: () => void; onClose: () => void }) {
  const today = todayLocal();
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [destType, setDestType] = useState<DestType>(trip?.destType ?? "beach");
  const [startDate, setStartDate] = useState(trip?.startDate ?? plusDays(today, 14));
  const [endDate, setEndDate] = useState(trip?.endDate ?? plusDays(today, 17));
  const [budget, setBudget] = useState(trip?.budgetAmount ? groupAmountTyping(String(trip.budgetAmount)) : "");
  const [name, setName] = useState(trip?.name ?? "");
  const [nameEdited, setNameEdited] = useState(Boolean(trip));
  const [error, setError] = useState("");

  // The name follows destination + season until the family touches it.
  const suggested = useMemo(() => destination.trim() ? suggestTripName(destination, startDate) : "", [destination, startDate]);
  useEffect(() => { if (!nameEdited) setName(suggested); }, [suggested, nameEdited]);
  // The return date keeps up when the departure moves past it.
  useEffect(() => { if (endDate < startDate) setEndDate(startDate); }, [startDate, endDate]);

  const budgetAmount = budget.trim() ? parseVnd(budget) : 0;

  function submit() {
    if (!destination.trim()) { setError("Nhập điểm đến"); return; }
    if (!name.trim()) { setError("Nhập tên chuyến"); return; }
    if (budgetAmount === null || budgetAmount < 0) { setError("Ngân sách chưa đúng (vd 15tr, 5.000.000)"); return; }
    onSave({
      id: trip?.id ?? crypto.randomUUID(), name: name.trim().slice(0, 80), destination: destination.trim().slice(0, 120), destType,
      startDate, endDate, status: trip?.status ?? "planning", budgetAmount: budgetAmount ?? 0,
      budgetSplit: trip?.budgetSplit, memberIds: trip?.memberIds, links: trip?.links, goalId: trip?.goalId,
      pushEnabled: trip?.pushEnabled ?? true, note: trip?.note,
    });
  }

  return <>
    <div className="tv-scrim" onClick={onClose} />
    <div className="tv-sheet" role="dialog" aria-modal="true" aria-label={trip ? "Sửa chuyến đi" : "Tạo chuyến đi"}>
      <button type="button" className="tv-sheet-x" onClick={onClose} aria-label="Đóng">✕</button>
      <h3>{trip ? "Sửa chuyến đi" : <>Tạo chuyến đi <small>· ~1 phút</small></>}</h3>
      <label className="tv-field">Điểm đến
        <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Đà Nẵng" maxLength={120} autoFocus={!trip} />
      </label>
      <div className="tv-field"><span>Kiểu chuyến đi <small>· để gợi ý đồ đạc</small></span>
        <div className="tv-chips" role="radiogroup" aria-label="Kiểu chuyến đi">
          {DEST_TYPES.map((type) => <button key={type} type="button" className={type === destType ? "on" : undefined} aria-pressed={type === destType} onClick={() => setDestType(type)}>{DEST_TYPE_LABELS[type].emoji} {DEST_TYPE_LABELS[type].label}</button>)}
        </div>
      </div>
      <div className="tv-field-row">
        <label className="tv-field">Ngày đi<input type="date" value={startDate} onChange={(event) => event.target.value && setStartDate(event.target.value)} /></label>
        <label className="tv-field">Ngày về<input type="date" value={endDate} min={startDate} onChange={(event) => event.target.value && setEndDate(event.target.value)} /></label>
      </div>
      <label className="tv-field">Ngân sách dự kiến
        <input inputMode="numeric" value={budget} onChange={(event) => setBudget(groupAmountTyping(event.target.value))} placeholder="15tr" />
        <small>{budgetAmount ? `≈ ${vndCompact(budgetAmount)} — ` : ""}chia gợi ý: đi lại 35% · lưu trú 25% · ăn uống 25% · hoạt động 10% · dự phòng 5%.</small>
      </label>
      <label className="tv-field">Tên chuyến
        <input value={name} onChange={(event) => { setName(event.target.value); setNameEdited(true); }} maxLength={80} />
        <small>Thành viên mặc định: cả nhà — sửa trong Tổng quan.</small>
      </label>
      {error && <p className="tv-error" role="alert">{error}</p>}
      <button type="button" className="tv-btn tv-btn-primary tv-btn-block" onClick={submit}>{trip ? "Lưu thay đổi" : "Tạo & vào không gian chuyến đi →"}</button>
      {trip && onDelete && <button type="button" className="tv-btn tv-btn-danger tv-btn-block" onClick={() => { if (confirm(`Xoá chuyến "${trip.name}"? Lịch trình, đồ đạc và chi phí của chuyến sẽ bị xoá.`)) onDelete(); }}>Xoá chuyến đi</button>}
    </div>
  </>;
}
