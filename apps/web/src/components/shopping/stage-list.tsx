"use client";

import { useState } from "react";
import { savePlanEntry } from "@/lib/shopping/item-client";
import type { PlanEntry } from "@/lib/shopping/plan";
import type { StageSuggestion } from "@/lib/shopping/stages";

/** "Sắp tới theo giai đoạn của bé": add to this month's plan, mark "Đã có", or hide — no products, no shop. */
export function StageList({ stages, month, onChanged }: { stages: StageSuggestion[]; month: string; onChanged: () => void }) {
  const [error, setError] = useState("");
  if (!stages.length) return null;
  async function save(stage: StageSuggestion, status: PlanEntry["status"]) {
    try { await savePlanEntry({ id: crypto.randomUUID(), month, stageKey: stage.key, name: stage.title, packs: 1, reason: "stage", status }); setError(""); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa lưu được."); }
  }
  return <section className="app-section" aria-labelledby="stages-title">
    <h2 id="stages-title">Sắp tới theo giai đoạn của bé</h2>
    <div className="app-card app-rows stages">{stages.map((stage) => <div key={stage.key}>
      <span><b>{stage.title}</b><small>{stage.detail} · {stage.when}</small></span>
      {!stage.when.includes("đã có trong kế hoạch") && <span className="row-actions">
        <button type="button" className="ledger-link" onClick={() => void save(stage, "planned")}>Thêm vào kế hoạch</button>
        <button type="button" className="ledger-link" onClick={() => void save(stage, "bought")}>Đã có</button>
        <button type="button" className="ledger-link" onClick={() => void save(stage, "skipped")}>Ẩn</button>
      </span>}
    </div>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
