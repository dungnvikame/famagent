"use client";

import { shortVnd } from "@/lib/money/summary";
import { daysBetween, type ItemEstimate } from "@/lib/shopping/items";

export interface TimelineMarker { on: string; label: string; kind: "payday" | "sale" }

const HORIZON = 30;
const dayLabel = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
export const tone = (daysLeft: number) => daysLeft <= 3 ? "warn" : daysLeft <= 7 ? "info" : "ok";

/** "Sắp cần mua · 30 ngày tới": each known item sits at its forecast run-out day; paydays and sale days are markers. */
export function UpcomingTimeline({ estimates, today, markers = [], actions }: { estimates: ItemEstimate[]; today: string; markers?: TimelineMarker[]; actions: (estimate: ItemEstimate) => React.ReactNode }) {
  const due = estimates.filter((estimate) => estimate.daysLeft !== null && estimate.daysLeft <= HORIZON);
  const pos = (on: string) => `${Math.min(100, Math.max(0, daysBetween(today, on) / HORIZON * 100))}%`;
  return <section className="app-section" aria-labelledby="up-title">
    <h2 id="up-title">Sắp cần mua · 30 ngày tới</h2>
    <div className="app-card">
      {due.length ? <>
        <div className="timeline" aria-hidden="true">
          <span className="timeline-line" />
          {markers.filter((marker) => daysBetween(today, marker.on) >= 0 && daysBetween(today, marker.on) <= HORIZON).map((marker) => <span key={`${marker.kind}-${marker.on}`} className={`timeline-marker ${marker.kind}`} style={{ left: pos(marker.on) }}><em>{marker.label}</em></span>)}
          {due.map((estimate, index) => <span key={estimate.item.id} className={`timeline-dot ${tone(estimate.daysLeft!)}${index % 2 ? " low" : ""}`} style={{ left: pos(estimate.runsOutOn!) }}><em>{estimate.item.name}</em></span>)}
        </div>
        <div className="app-rows timeline-rows">{due.map((estimate) => <div key={estimate.item.id}>
          <span><b>{estimate.item.name}</b><small className={`due ${tone(estimate.daysLeft!)}`}>{estimate.daysLeft === 0 ? "Ước tính đã hết" : `Còn ~${estimate.daysLeft} ngày · hết khoảng ${dayLabel(estimate.runsOutOn!)}`}{estimate.lastPackPrice ? ` · lần trước ${shortVnd(estimate.lastPackPrice)}/gói` : ""}</small></span>
          <span className="row-actions">{actions(estimate)}</span>
        </div>)}</div>
      </> : <p className="app-sub" style={{ margin: 0 }}>Chưa có món nào sắp hết trong 30 ngày. Ghi lần mua để FamAgent tính ngày hết cho từng món.</p>}
    </div>
  </section>;
}
