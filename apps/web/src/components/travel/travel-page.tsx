"use client";

// /travel — the trip list: upcoming trips with a countdown and one next action, past trips as memories.
// Reached from the Home card and the Gia đình page; Travel is not a nav tab (plan 261010-1335 §3.1).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { vndCompact } from "@/lib/money/format-vnd";
import { formatVnDate, todayLocal } from "@/lib/money/parse";
import { deleteTrip, loadTravel, saveTrip } from "@/lib/travel/client";
import { countdownDays, nextAction, orderTrips, tripDays, tripPhase, tripReadiness } from "@/lib/travel/trip-state";
import { DEST_TYPE_LABELS, type TravelState, type Trip } from "@/lib/travel/types";
import { TripForm } from "./trip-form";

export function TravelPage() {
  const router = useRouter();
  const [state, setState] = useState<TravelState | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const today = todayLocal();

  useEffect(() => { loadTravel().then(setState).catch((failure: Error) => setError(failure.message)); }, []);

  async function create(trip: Trip) {
    setCreating(false);
    setState((previous) => previous ? { ...previous, trips: [...previous.trips, trip] } : previous);
    try { await saveTrip(trip); router.push(`/travel/${trip.id}`); }
    catch (failure) { setError((failure as Error).message); setState((previous) => previous ? { ...previous, trips: previous.trips.filter((entry) => entry.id !== trip.id) } : previous); }
  }

  async function removePast(trip: Trip) {
    if (!confirm(`Xoá chuyến "${trip.name}"? Lịch trình, đồ đạc và chi phí của chuyến sẽ bị xoá.`)) return;
    setState((previous) => previous ? { ...previous, trips: previous.trips.filter((entry) => entry.id !== trip.id) } : previous);
    try { await deleteTrip(trip.id); } catch (failure) { setError((failure as Error).message); }
  }

  const { active, past } = orderTrips(state?.trips ?? [], today);

  return <div className="tv-page">
    <header className="tv-head">
      <h1>Chuyến đi</h1>
      <button type="button" className="tv-btn tv-btn-primary" onClick={() => setCreating(true)}>＋ Tạo chuyến đi</button>
    </header>
    {error && <p className="tv-error" role="alert">{error}</p>}
    {!state && !error && <p className="tv-muted">Đang tải…</p>}

    {state && active.length === 0 && past.length === 0 && <div className="tv-empty">
      <span aria-hidden="true">🧳</span>
      <p>Lên kế hoạch cho chuyến đi của cả nhà: lịch trình theo ngày, checklist đồ (tự gợi ý theo các bé) và chi phí nối thẳng vào sổ Tài chính.</p>
    </div>}

    {active.length > 0 && <>
      <h2 className="tv-sec">Sắp tới</h2>
      {active.map((trip) => {
        const countdown = countdownDays(trip, today);
        const ready = tripReadiness(trip, (state?.itinerary ?? []).filter((entry) => entry.tripId === trip.id), (state?.packing ?? []).filter((item) => item.tripId === trip.id), (state?.expenses ?? []).filter((expense) => expense.tripId === trip.id));
        const action = nextAction(ready, countdown);
        const ongoing = tripPhase(trip, today) === "ongoing";
        return <article key={trip.id} className="tv-card tv-trip-hero">
          <div className="tv-cd" aria-hidden="true">{ongoing ? <><b>✈️</b><span>đang đi</span></> : <><b>{countdown}</b><span>ngày nữa</span></>}</div>
          <div className="tv-trip-info">
            <h3><Link href={`/travel/${trip.id}`}>{DEST_TYPE_LABELS[trip.destType].emoji} {trip.name}</Link></h3>
            <p className="tv-muted">{formatVnDate(trip.startDate)} – {formatVnDate(trip.endDate)} · {tripDays(trip).length} ngày{trip.budgetAmount ? ` · ngân sách ${vndCompact(trip.budgetAmount)}` : ""}</p>
            <div className="tv-mini">
              <span>Lịch trình {ready.daysPlanned}/{ready.daysTotal} ngày</span>
              <span>Đồ đạc {ready.packed}/{ready.packTotal || 0} món</span>
              {trip.budgetAmount > 0 && <span>Đã dùng {ready.budgetPct}% ngân sách</span>}
            </div>
          </div>
          <div className="tv-trip-act">
            <Link className="tv-btn tv-btn-primary tv-btn-sm" href={`/travel/${trip.id}`}>Mở chuyến đi →</Link>
            <Link className="tv-btn tv-btn-ghost tv-btn-sm" href={`/travel/${trip.id}?tab=${action.tab}`}>{action.label}</Link>
          </div>
        </article>;
      })}
    </>}

    {past.length > 0 && <>
      <h2 className="tv-sec">Kỷ niệm</h2>
      <div className="tv-past">
        {past.map((trip) => <article key={trip.id} className="tv-past-card">
          <span aria-hidden="true">{trip.status === "cancelled" ? "🚫" : DEST_TYPE_LABELS[trip.destType].emoji}</span>
          <Link href={`/travel/${trip.id}`}><b>{trip.name}</b><small>{formatVnDate(trip.startDate)}{trip.status === "cancelled" ? " · đã huỷ" : ""}</small></Link>
          <button type="button" className="tv-x" onClick={() => removePast(trip)} aria-label={`Xoá chuyến ${trip.name}`}>🗑</button>
        </article>)}
      </div>
    </>}

    {creating && <TripForm onSave={create} onClose={() => setCreating(false)} />}
  </div>;
}
