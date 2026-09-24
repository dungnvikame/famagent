"use client";

import { useState } from "react";
import type { FamilyProfile } from "@/lib/experience/types";
import { allocationFrom, customFramework } from "@/lib/money/allocation";
import { babyStep, frameworkById, frameworkProgress, type FrameworkId } from "@/lib/money/frameworks";
import type { MonthSummary } from "@/lib/money/summary";
import type { MoneyAllocation, MoneyBundle, MoneyCategory } from "@/lib/money/types";
import { money } from "@/lib/onboarding/assessment";
import { AllocationEditor } from "./allocation-editor";
import { FrameworkChooser } from "./framework-chooser";

interface Props {
  profile: FamilyProfile; summary: MonthSummary; bundle: MoneyBundle;
  onChoose: (id: FrameworkId) => void;
  /** Saves the family's own split (+ any categories added while editing) and switches the method to "custom". */
  onSaveCustom: (allocation: MoneyAllocation, categories: MoneyCategory[]) => Promise<void>;
}

// Parts that are "at least" targets in the well-known frameworks; custom parts carry their own flag.
const SAVING_KEYS = ["save", "ltss", "ffa", "assigned"];

/**
 * The family's money framework on the Money page: each part's target (share × income) vs what the ledger shows
 * this month. Without a choice it invites the family to pick one — or to design its own split.
 */
export function FrameworkPanel({ profile, summary, bundle, onChoose, onSaveCustom }: Props) {
  const [mode, setMode] = useState<"view" | "choose" | "edit">("view");
  const [seed, setSeed] = useState<MoneyAllocation | null>(null);
  const method = profile.household?.moneyMethod;
  const custom = method === "custom" && bundle.settings.allocation ? customFramework(bundle.settings.allocation) : undefined;
  const fw = custom ?? frameworkById(method);
  // Targets follow real income this month; before any income is logged, use the onboarding estimate.
  const income = summary.income || profile.household?.monthlyIncome || 0;
  const monthTx = bundle.transactions.filter((tx) => tx.occurredOn.startsWith(summary.month));

  function customize(from: FrameworkId | "blank") {
    setSeed(from === "custom" && bundle.settings.allocation ? bundle.settings.allocation : allocationFrom(from === "custom" ? "blank" : from, bundle.settings.categories));
    setMode("edit");
  }

  if (mode === "edit" && seed) return <section className="app-card fw-panel">
    <AllocationEditor initial={seed} categories={bundle.settings.categories} income={income} onCancel={() => setMode(fw ? "view" : "choose")} onSave={async (allocation, categories) => { await onSaveCustom(allocation, categories); setMode("view"); }} />
  </section>;

  if (!fw || mode === "choose") return <section className="app-card fw-panel">
    <div className="fw-panel-head"><div><b>{fw ? "Đổi cách chia tiền" : "Chọn cách chia tiền cho nhà mình"}</b><small>Dùng phương pháp nổi tiếng, hoặc tự chia theo nhu cầu riêng. FamAgent sẽ chia sổ thu chi theo cách bạn chọn.</small></div>{fw && <button type="button" className="ledger-link" onClick={() => setMode("view")}>Đóng</button>}</div>
    <FrameworkChooser profile={profile} value={custom ? "custom" : fw?.id} onChange={(id) => { onChoose(id); setMode("view"); }} onCustomize={customize} />
  </section>;

  const progress = frameworkProgress(fw, income, monthTx, bundle.budgets);
  return <section className="app-card fw-panel">
    <div className="fw-panel-head"><div><b>{fw.name}</b><small>{custom ? `${fw.origin}${income ? ` · theo thu nhập ${money(income)}` : ""}` : fw.origin}</small></div>
      <span className="row-actions">{custom && <button type="button" className="ledger-link" onClick={() => customize("custom")}>Chỉnh</button>}<button type="button" className="ledger-link" onClick={() => setMode("choose")}>Đổi phương pháp</button></span></div>
    {fw.id === "baby-steps" && <p className="fw-note">Nhà mình đang ở {babyStep(profile).text}</p>}
    {fw.id === "kakeibo" && <p className="fw-note">Cuối tháng tự hỏi: Thu bao nhiêu? Muốn để dành bao nhiêu? Đã tiêu bao nhiêu? Tháng sau cải thiện gì?</p>}
    {!income && fw.buckets.some((bucket) => bucket.share !== undefined) && <p className="fw-note">Ghi khoản thu (lương) tháng này để thấy mức mục tiêu của từng phần.</p>}
    <div className="fw-progress">{progress.map((bucket) => {
      const ratio = bucket.target ? bucket.actual / bucket.target : undefined;
      // Saving parts are "at least" targets; spending parts are "at most".
      const isSaving = bucket.atLeast ?? SAVING_KEYS.includes(bucket.key);
      const over = ratio !== undefined && !isSaving && ratio > 1;
      return <div key={bucket.key} className="fw-row">
        <div className="fw-row-top"><b>{bucket.label}{bucket.share !== undefined ? ` · ${Math.round(bucket.share * 1000) / 10}%` : ""}</b><span>{money(bucket.actual)}{bucket.target !== undefined && bucket.target > 0 ? ` / ${money(bucket.target)}` : ""}</span></div>
        {bucket.target ? <span className="bar"><span style={{ width: `${Math.min(100, Math.round((ratio ?? 0) * 100))}%` }} className={over ? "over" : undefined} /></span> : null}
        <small>{bucket.hint}{over ? " · đã vượt mức" : isSaving && ratio !== undefined && ratio < 1 ? ` · còn thiếu ${money(bucket.target! - bucket.actual)}` : ""}</small>
      </div>;
    })}</div>
  </section>;
}
