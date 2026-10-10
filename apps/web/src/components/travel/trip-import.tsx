"use client";

// "Nhập từ tour" (plan 261010-1335, usecase "forward/upload thay vì gõ"): paste the tour programme or photograph
// it, the model splits it into itinerary entries + packing items, and the family unticks what they don't want
// before anything is added. Demo mode has no model, so the host hides the button.
import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/image/shrink";
import { vndCompact } from "@/lib/money/format-vnd";
import type { PackingSuggestion } from "@/lib/travel/packing-template";
import type { ImportedEntry } from "@/lib/travel/import-ai";
import { tripDays } from "@/lib/travel/trip-state";
import { PACKING_CATEGORY_LABELS, type ItineraryEntry, type PackingItem, type Trip } from "@/lib/travel/types";

export function ImportSheet({ trip, entries, packing, vision, onAdd, onClose }: {
  trip: Trip; entries: ItineraryEntry[]; packing: PackingItem[];
  /** Whether the server can read photos (GET /api/travel/import). */
  vision: boolean;
  onAdd: (entries: ItineraryEntry[], packing: PackingItem[]) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<{ itinerary: ImportedEntry[]; packing: PackingSuggestion[] } | null>(null);
  const [offEntries, setOffEntries] = useState<Set<number>>(new Set());
  const [offPacking, setOffPacking] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const days = tripDays(trip);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try { setImage(await shrinkImage(file)); setError(""); }
    catch { setError("Không đọc được ảnh này — thử ảnh khác."); }
  }

  async function parse() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/travel/import", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: trip.destination, days: days.length, text: text.trim() || undefined, image: image ?? undefined, existingPacking: packing.map((item) => item.name) }),
      });
      const data = await response.json().catch(() => ({})) as { itinerary?: ImportedEntry[]; packing?: PackingSuggestion[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa đọc được lịch trình này.");
      setParsed({ itinerary: data.itinerary ?? [], packing: data.packing ?? [] });
      setOffEntries(new Set()); setOffPacking(new Set());
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  function confirm() {
    if (!parsed) return;
    // Imported entries queue up after what each day already has.
    const positions = new Map<string, number>();
    const nextPosition = (day?: string) => {
      const key = day ?? "";
      const base = positions.get(key) ?? entries.filter((entry) => entry.dayDate === day).reduce((max, entry) => Math.max(max, entry.position), -1);
      positions.set(key, base + 1);
      return base + 1;
    };
    const newEntries = parsed.itinerary.filter((_, index) => !offEntries.has(index)).map((entry) => {
      const dayDate = entry.day ? days[entry.day - 1] : undefined;
      return { id: crypto.randomUUID(), tripId: trip.id, dayDate, position: nextPosition(dayDate), timeLabel: entry.timeLabel, title: entry.title, note: entry.note, estAmount: entry.estAmount } satisfies ItineraryEntry;
    });
    const newPacking = parsed.packing.filter((_, index) => !offPacking.has(index)).map((item) => ({ id: crypto.randomUUID(), tripId: trip.id, name: item.name, qty: item.qty, category: item.category, memberId: item.memberId, status: "todo", source: "ai" } satisfies PackingItem));
    onAdd(newEntries, newPacking);
    onClose();
  }

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<number>>>) => (index: number) => set((previous) => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const pickedCount = parsed ? parsed.itinerary.length - offEntries.size + parsed.packing.length - offPacking.size : 0;
  const byDay = (day: number | undefined) => (parsed?.itinerary ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.day === day);
  const shownDays = [...new Set((parsed?.itinerary ?? []).map((entry) => entry.day))].sort((a, b) => (a ?? 99) - (b ?? 99));

  return <>
    <div className="tv-scrim" onClick={onClose} />
    <div className="tv-sheet" role="dialog" aria-modal="true" aria-label="Nhập lịch trình từ tour">
      <button type="button" className="tv-sheet-x" onClick={onClose} aria-label="Đóng">✕</button>
      <h3>📄 Nhập từ tour <small>· dán hoặc chụp — bạn duyệt trước khi thêm</small></h3>

      {!parsed && <>
        <textarea className="tv-import-text" value={text} onChange={(event) => setText(event.target.value.slice(0, 8000))} rows={7}
          placeholder={"Dán chương trình tour / lịch trình vào đây…\nVD:  NGÀY 01: HÀ NỘI – ĐÀ NẴNG\n06:00 Xe đón tại điểm hẹn…\nCó mục “đồ cần chuẩn bị” thì FamAgent tách luôn vào checklist."} />
        <div className="tv-import-row">
          {vision && <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void pickImage(event.target.files?.[0])} />
            <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={() => fileRef.current?.click()}>{image ? "Đổi ảnh" : "📷 Chụp / chọn ảnh tour"}</button>
            {image && <span className="tv-pill tv-pill-ok">Đã đính kèm ảnh ✓ <button type="button" className="tv-x" onClick={() => setImage(null)} aria-label="Bỏ ảnh">✕</button></span>}
          </>}
          <span className="tv-sp" />
          <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={() => void parse()} disabled={busy || (!text.trim() && !image)}>{busy ? "Đang đọc…" : "Đọc & xem trước"}</button>
        </div>
        <p className="tv-hint">Chỉ nội dung bạn dán/chụp được gửi cho AI trong một lần đọc — không lưu lại, không kèm thông tin gia đình.</p>
      </>}

      {parsed && <>
        <div className="tv-suggest-list">
          {shownDays.map((day) => <div key={day ?? "x"}>
            <h5>{day ? `Ngày ${day} · ${days[day - 1]?.slice(8, 10)}/${days[day - 1]?.slice(5, 7)}` : "Chưa rõ ngày (vào mục chưa xếp)"}</h5>
            {byDay(day).map(({ entry, index }) => <label key={index} className="tv-suggest">
              <input type="checkbox" checked={!offEntries.has(index)} onChange={() => toggle(setOffEntries)(index)} />
              <span>{entry.timeLabel && <b className="tv-import-time">{entry.timeLabel}</b>} {entry.title}{entry.estAmount > 0 && <em className="tv-import-cost"> ~{vndCompact(entry.estAmount)}</em>}{entry.note && <small className="tv-muted"> — {entry.note}</small>}</span>
            </label>)}
          </div>)}
          {parsed.packing.length > 0 && <div>
            <h5>Đồ cần chuẩn bị (vào checklist Đồ đạc)</h5>
            {parsed.packing.map((item, index) => <label key={index} className="tv-suggest">
              <input type="checkbox" checked={!offPacking.has(index)} onChange={() => toggle(setOffPacking)(index)} />
              <span>{item.name}{item.qty > 1 ? ` ×${item.qty}` : ""} <small className="tv-muted">· {PACKING_CATEGORY_LABELS[item.category]}</small></span>
            </label>)}
          </div>}
        </div>
        <div className="tv-import-row">
          <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={() => setParsed(null)}>← Sửa nội dung</button>
          <span className="tv-sp" />
          <button type="button" className="tv-btn tv-btn-primary tv-btn-sm" onClick={confirm} disabled={pickedCount === 0}>Thêm {pickedCount} mục đã chọn</button>
        </div>
      </>}

      {error && <p className="tv-error" role="alert">{error}</p>}
    </div>
  </>;
}
