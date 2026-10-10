"use client";

// /travel/[tripId] — one trip's workspace: Tổng quan · Lịch trình · Đồ đạc · Chi phí (plan 261010-1335 §4).
// Loads everything once, keeps it in state, saves optimistically and reverts on failure.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { loadMoney } from "@/lib/money/client";
import { vndCompact } from "@/lib/money/format-vnd";
import { formatVnDate, todayLocal } from "@/lib/money/parse";
import { monthKey } from "@/lib/money/summary";
import type { MoneyGoal } from "@/lib/money/types";
import * as client from "@/lib/travel/client";
import { tripMembers } from "@/lib/travel/trip-members";
import { countdownDays, tripDays, tripPhase, tripReadiness } from "@/lib/travel/trip-state";
import { DEST_TYPE_LABELS, type ItineraryEntry, type PackingItem, type TravelState, type Trip, type TripExpense } from "@/lib/travel/types";
import { TripExpenses } from "./trip-expenses";
import { TripForm } from "./trip-form";
import { TripItinerary } from "./trip-itinerary";
import { TripOverview } from "./trip-overview";
import { TripPacking } from "./trip-packing";

export type TripTab = "overview" | "itin" | "packing" | "money";
const PHASE_LABELS: Record<Trip["status"], string> = { planning: "Đang chuẩn bị", ongoing: "Đang đi 🏖️", done: "Đã về", cancelled: "Đã huỷ" };

export function TripWorkspace({ tripId }: { tripId: string }) {
  const router = useRouter();
  const today = todayLocal();
  const [state, setState] = useState<TravelState | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [tab, setTab] = useState<TripTab>("overview");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState<MoneyGoal[]>([]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted === "itin" || wanted === "packing" || wanted === "money") setTab(wanted);
    loadTravelData();
    (cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())).then(setProfile).catch(() => {});
    // Saving goals are optional context for "Quỹ cho chuyến này"; a failure just hides the box's picker.
    loadMoney(monthKey(new Date())).then((bundle) => setGoals(bundle.goals)).catch(() => {});
  }, []);
  function loadTravelData() { client.loadTravel().then(setState).catch((failure: Error) => setError(failure.message)); }

  const trip = state?.trips.find((entry) => entry.id === tripId);
  const itinerary = useMemo(() => (state?.itinerary ?? []).filter((entry) => entry.tripId === tripId), [state, tripId]);
  const packing = useMemo(() => (state?.packing ?? []).filter((item) => item.tripId === tripId), [state, tripId]);
  const expenses = useMemo(() => (state?.expenses ?? []).filter((expense) => expense.tripId === tripId), [state, tripId]);
  const members = useMemo(() => tripMembers(profile, today), [profile, today]);
  // The newest other trip with a checklist: "chép checklist từ chuyến trước" when this trip's list is empty.
  const copySource = useMemo(() => {
    const donor = (state?.trips ?? []).filter((entry) => entry.id !== tripId && (state?.packing ?? []).some((item) => item.tripId === entry.id))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    return donor ? { name: donor.name, items: (state?.packing ?? []).filter((item) => item.tripId === donor.id) } : undefined;
  }, [state, tripId]);

  /** Optimistic write: apply, persist; a failed save surfaces the error and reloads the saved truth. */
  function mutate(apply: (previous: TravelState) => TravelState, persistChange: () => Promise<unknown>) {
    setError("");
    setState((previous) => previous ? apply(previous) : previous);
    persistChange().catch((failure: Error) => { setError(failure.message); loadTravelData(); });
  }
  const upsert = <T extends { id: string }>(list: T[], item: T) => [...list.filter((entry) => entry.id !== item.id), item];

  const saveTrip = (next: Trip) => mutate((previous) => ({ ...previous, trips: upsert(previous.trips, next) }), () => client.saveTrip(next));
  const saveEntry = (entry: ItineraryEntry) => mutate((previous) => ({ ...previous, itinerary: upsert(previous.itinerary, entry) }), () => client.saveEntry(entry));
  const removeEntry = (id: string) => mutate((previous) => ({ ...previous, itinerary: previous.itinerary.filter((entry) => entry.id !== id) }), () => client.deleteEntry(id));
  const savePacking = (item: PackingItem) => mutate((previous) => ({ ...previous, packing: upsert(previous.packing, item) }), () => client.savePacking(item));
  const savePackingMany = (items: PackingItem[]) => mutate(
    (previous) => ({ ...previous, packing: items.reduce(upsert, previous.packing) }),
    () => Promise.all(items.map((item) => client.savePacking(item))),
  );
  const removePacking = (id: string) => mutate((previous) => ({ ...previous, packing: previous.packing.filter((item) => item.id !== id) }), () => client.deletePacking(id));
  const saveExpense = (expense: TripExpense) => mutate(
    (previous) => ({ ...previous, expenses: upsert(previous.expenses, expense) }),
    // The server answers with the mirrored ledger row's transactionId — fold it back in ("đã vào sổ ✓").
    () => client.saveExpense(expense).then((stored) => setState((previous) => previous ? { ...previous, expenses: upsert(previous.expenses, stored) } : previous)),
  );
  const removeExpense = (id: string) => mutate((previous) => ({ ...previous, expenses: previous.expenses.filter((expense) => expense.id !== id) }), () => client.deleteExpense(id));

  async function removeTrip() {
    try { await client.deleteTrip(tripId); router.push("/travel"); }
    catch (failure) { setError((failure as Error).message); }
  }

  if (!state && !error) return <div className="tv-page"><p className="tv-muted">Đang tải…</p></div>;
  if (!trip) return <div className="tv-page">
    {error && <p className="tv-error" role="alert">{error}</p>}
    {state && <p className="tv-muted">Không tìm thấy chuyến đi này. <Link href="/travel">← Về danh sách chuyến đi</Link></p>}
  </div>;

  const phase = tripPhase(trip, today);
  const countdown = countdownDays(trip, today);
  const ready = tripReadiness(trip, itinerary, packing, expenses);
  const packLeft = ready.packLeft;

  return <div className="tv-page">
    <Link className="tv-crumb" href="/travel">← Chuyến đi</Link>
    {error && <p className="tv-error" role="alert">{error}</p>}

    <header className="tv-card tv-trip-head">
      <span className="tv-trip-emoji" aria-hidden="true">{DEST_TYPE_LABELS[trip.destType].emoji}</span>
      <div className="tv-trip-title">
        <h1>{trip.name}</h1>
        <p className="tv-muted">
          {formatVnDate(trip.startDate)} – {formatVnDate(trip.endDate)} · {tripDays(trip).length}N{Math.max(0, tripDays(trip).length - 1)}Đ
          {trip.budgetAmount > 0 && <> · ngân sách {vndCompact(trip.budgetAmount)}</>}
          {" · "}<button type="button" className="tv-link" onClick={() => setEditing(true)}>Sửa</button>
        </p>
      </div>
      {phase === "planning" && <span className="tv-pill tv-pill-note">⏳ Còn {countdown} ngày</span>}
      <span className={`tv-pill ${phase === "cancelled" ? "tv-pill-warn" : "tv-pill-ok"}`}>{PHASE_LABELS[phase]}</span>
    </header>

    <nav className="tv-tabs" aria-label="Khu vực trong chuyến đi">
      <button type="button" className={tab === "overview" ? "on" : undefined} onClick={() => setTab("overview")}>Tổng quan</button>
      <button type="button" className={tab === "itin" ? "on" : undefined} onClick={() => setTab("itin")}>Lịch trình</button>
      <button type="button" className={tab === "packing" ? "on" : undefined} onClick={() => setTab("packing")}>Đồ đạc{packLeft > 0 && <em className="tv-badge">{packLeft}</em>}</button>
      <button type="button" className={tab === "money" ? "on" : undefined} onClick={() => setTab("money")}>Chi phí</button>
    </nav>

    {tab === "overview" && <TripOverview trip={trip} phase={phase} readiness={ready} countdown={countdown} packing={packing} expenses={expenses} members={members} goals={goals} onTrip={saveTrip} onPacking={savePacking} onTab={setTab} />}
    {tab === "itin" && <TripItinerary trip={trip} entries={itinerary} onSave={saveEntry} onDelete={removeEntry} />}
    {tab === "packing" && <TripPacking trip={trip} items={packing} members={members} aiConsent={profile?.aiConsent === true} copySource={copySource} onSave={savePacking} onSaveMany={savePackingMany} onDelete={removePacking} />}
    {tab === "money" && <TripExpenses trip={trip} expenses={expenses} itinerary={itinerary} onSave={saveExpense} onDelete={removeExpense} onTrip={saveTrip} />}

    {editing && <TripForm trip={trip} onSave={(next) => { saveTrip(next); setEditing(false); }} onDelete={removeTrip} onClose={() => setEditing(false)} />}
  </div>;
}
