"use client";

import { useState } from "react";
import type { FamilyProfile } from "@/lib/experience/types";
import { babyStep, frameworkById, frameworkProgress, type FrameworkId } from "@/lib/money/frameworks";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyBundle } from "@/lib/money/types";
import { money } from "@/lib/onboarding/assessment";
import { FrameworkChooser } from "./framework-chooser";

/**
 * The family's chosen money framework on the Money page: each bucket's target (share × income) vs what the ledger
 * shows this month. Without a choice, it invites the family to pick one.
 */
export function FrameworkPanel({ profile, summary, bundle, onChoose }: { profile: FamilyProfile; summary: MonthSummary; bundle: MoneyBundle; onChoose: (id: FrameworkId) => void }) {
  const [choosing, setChoosing] = useState(false);
  const fw = frameworkById(profile.household?.moneyMethod);
  // Targets follow real income this month; before any income is logged, use the onboarding estimate.
  const income = summary.income || profile.household?.monthlyIncome || 0;
  const monthTx = bundle.transactions.filter((tx) => tx.occurredOn.startsWith(summary.month));

  if (!fw || choosing) return <section className="app-card fw-panel">
    <div className="fw-panel-head"><div><b>{fw ? "Đổi phương pháp quản lý tiền" : "Chọn cách quản lý tiền cho nhà mình"}</b><small>Những phương pháp được nhiều gia đình trên thế giới dùng. FamAgent sẽ chia sổ thu chi theo cách bạn chọn.</small></div>{fw && <button type="button" className="ledger-link" onClick={() => setChoosing(false)}>Đóng</button>}</div>
    <FrameworkChooser profile={profile} value={fw?.id} onChange={(id) => { onChoose(id); setChoosing(false); }} />
  </section>;

  const progress = frameworkProgress(fw, income, monthTx, bundle.budgets);
  return <section className="app-card fw-panel">
    <div className="fw-panel-head"><div><b>{fw.name}</b><small>{fw.origin}</small></div><button type="button" className="ledger-link" onClick={() => setChoosing(true)}>Đổi phương pháp</button></div>
    {fw.id === "baby-steps" && <p className="fw-note">Nhà mình đang ở {babyStep(profile).text}</p>}
    {fw.id === "kakeibo" && <p className="fw-note">Cuối tháng tự hỏi: Thu bao nhiêu? Muốn để dành bao nhiêu? Đã tiêu bao nhiêu? Tháng sau cải thiện gì?</p>}
    {!income && fw.buckets.some((bucket) => bucket.share !== undefined) && <p className="fw-note">Ghi khoản thu (lương) tháng này để thấy mức mục tiêu của từng phần.</p>}
    <div className="fw-progress">{progress.map((bucket) => {
      const ratio = bucket.target ? bucket.actual / bucket.target : undefined;
      // Saving buckets are "at least" targets; spending buckets are "at most".
      const isSaving = ["save", "ltss", "ffa", "assigned"].includes(bucket.key);
      const over = ratio !== undefined && !isSaving && ratio > 1;
      return <div key={bucket.key} className="fw-row">
        <div className="fw-row-top"><b>{bucket.label}{bucket.share !== undefined ? ` · ${Math.round(bucket.share * 100)}%` : ""}</b><span>{money(bucket.actual)}{bucket.target !== undefined && bucket.target > 0 ? ` / ${money(bucket.target)}` : ""}</span></div>
        {bucket.target ? <span className="bar"><span style={{ width: `${Math.min(100, Math.round((ratio ?? 0) * 100))}%` }} className={over ? "over" : undefined} /></span> : null}
        <small>{bucket.hint}{over ? " · đã vượt mức" : isSaving && ratio !== undefined && ratio < 1 ? ` · còn thiếu ${money(bucket.target! - bucket.actual)}` : ""}</small>
      </div>;
    })}</div>
  </section>;
}
