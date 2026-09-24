"use client";

import { useState } from "react";
import type { FamilyProfile } from "@/lib/experience/types";
import type { ShoppingItem } from "@/lib/shopping/items";
import { itemFromStarter, starterItems } from "@/lib/shopping/starter";

/** Cold start: pick what the family uses now; FamAgent forecasts from the first logged purchase of each. */
export function StarterItems({ profile, onAdd }: { profile: FamilyProfile | null; onAdd: (items: ShoppingItem[]) => Promise<void> }) {
  const options = starterItems(profile);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(options.filter((option) => option.category === "diapers").map((option) => option.key)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (key: string) => setPicked((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  async function add() {
    setBusy(true); setError("");
    try { await onAdd(options.filter((option) => picked.has(option.key)).map(itemFromStarter)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
    finally { setBusy(false); }
  }

  return <section className="app-section" aria-labelledby="starter-title">
    <h2 id="starter-title">Nhà mình đang dùng gì?</h2>
    <div className="app-card starter">
      <p className="app-sub" style={{ marginTop: 0 }}>Chọn những thứ nhà mình hay mua. FamAgent theo dõi từng món, ước tính ngày hết và lập kế hoạch mua tháng — từ những lần mua bạn ghi.</p>
      <div className="starter-list">{options.map((option) => <label key={option.key} className={picked.has(option.key) ? "on" : undefined}>
        <input type="checkbox" checked={picked.has(option.key)} onChange={() => toggle(option.key)} />
        <span><b>{option.name}</b><small>{option.reason}</small></span>
      </label>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="app-btn" disabled={busy || !picked.size} onClick={() => void add()}>{busy ? "Đang lưu…" : `Theo dõi ${picked.size} món`}</button>
    </div>
  </section>;
}
