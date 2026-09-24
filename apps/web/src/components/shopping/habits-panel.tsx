"use client";

import { shortVnd } from "@/lib/money/summary";
import { categoriesIn, merchantShare, monthlySpend } from "@/lib/shopping/insights";
import { CATEGORY_LABELS, type ItemCategory, type ShoppingItem } from "@/lib/shopping/items";
import type { Purchase } from "@/lib/shopping/purchases";

/** Fixed colour per category so the legend, bars and item cards read as one system. */
export const CATEGORY_COLORS: Record<ItemCategory, string> = { diapers: "#5b4bb7", wipes: "#8f7ee6", milk: "#1f7a5a", solids: "#e08a4f", hygiene: "#c25e8c", household: "#3f7fb8", other: "#9a95ad" };

/** "Thói quen mua · 6 tháng": spend per month stacked by category, where the money went, and one line per note. */
export function HabitsPanel({ purchases, items, notes, now = new Date() }: { purchases: Purchase[]; items: ShoppingItem[]; notes: string[]; now?: Date }) {
  const lines = monthlySpend(purchases, items, 6, now);
  const categories = categoriesIn(lines);
  const max = Math.max(1, ...lines.map((line) => line.total));
  const since = lines[0].month + "-01";
  const shares = merchantShare(purchases, since);
  if (!lines.some((line) => line.total)) return null;
  return <section className="app-section" aria-labelledby="habits-title">
    <h2 id="habits-title">Thói quen mua · 6 tháng</h2>
    <div className="app-card habits">
      <div className="habits-bars" role="img" aria-label={lines.map((line) => `Tháng ${Number(line.month.slice(5))}: ${shortVnd(line.total)}`).join(", ")}>
        {lines.map((line) => <div key={line.month} className="habits-col">
          <small className="habits-total">{line.total ? shortVnd(line.total) : ""}</small>
          <span className="habits-stack" style={{ height: `${Math.round(line.total / max * 100)}%` }}>
            {categories.map((category) => line.byCategory[category] ? <span key={category} style={{ flexGrow: line.byCategory[category], background: CATEGORY_COLORS[category] }} title={`${CATEGORY_LABELS[category]}: ${shortVnd(line.byCategory[category]!)}`} /> : null)}
          </span>
          <small>T{Number(line.month.slice(5))}</small>
        </div>)}
      </div>
      <p className="habits-legend">{categories.map((category) => <span key={category}><i style={{ background: CATEGORY_COLORS[category] }} aria-hidden="true" />{CATEGORY_LABELS[category]}</span>)}</p>
      {shares.length > 0 && <div className="habits-share"><small>Nơi mua</small>
        <span className="share-bar" aria-hidden="true">{shares.map((share, index) => <span key={share.merchant} style={{ width: `${share.share}%`, opacity: 1 - index * 0.2 }} />)}</span>
        <small>{shares.map((share) => `${share.merchant} ${share.share}%`).join(" · ")}</small>
      </div>}
      {notes.map((note) => <p key={note} className="item-meta">{note}</p>)}
    </div>
  </section>;
}
