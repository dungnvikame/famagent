"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/experience/storage";
import { saveCheck } from "@/lib/shopping/item-client";
import { levelToRemaining, localDate, STOCK_LEVELS, type ItemEstimate } from "@/lib/shopping/items";

/** "Bỉm Merries còn không?" — one tap anchors the estimate at today and, over time, teaches the family's own rate. */
export function StockCheck({ estimate, compact = false, onDone }: { estimate: ItemEstimate; compact?: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function answer(level: (typeof STOCK_LEVELS)[number]["id"]) {
    setBusy(true); setError("");
    try {
      await saveCheck({ id: crypto.randomUUID(), itemId: estimate.item.id, checkedOn: localDate(new Date()), remaining: levelToRemaining(level, estimate) });
      trackEvent("stock_checked", { level, category: estimate.item.category });
      onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }
  return <div className={`stock-check${compact ? " compact" : ""}`} role="group" aria-label={`${estimate.item.name} còn không?`}>
    {!compact && <span>{estimate.item.name} còn không?</span>}
    <span className="chip-row">{STOCK_LEVELS.map((level) => <button key={level.id} type="button" className="chip" disabled={busy} onClick={() => void answer(level.id)}>{level.label}</button>)}</span>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

/** The one item worth asking about: forecast by default rate or not checked in a week, and running out within 10 days. */
export function checkCandidate(estimates: ItemEstimate[], lastCheckOn: (itemId: string) => string | undefined, today: string): ItemEstimate | undefined {
  return estimates.find((estimate) => estimate.known && estimate.daysLeft !== null && estimate.daysLeft <= 10 && estimate.rateSource !== "set"
    && (lastCheckOn(estimate.item.id) ?? "") < localDate(new Date(new Date(`${today}T00:00:00`).getTime() - 7 * 86_400_000)));
}
