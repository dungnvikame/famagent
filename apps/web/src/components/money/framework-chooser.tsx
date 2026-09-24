"use client";

import type { FamilyProfile } from "@/lib/experience/types";
import { babyStep, FRAMEWORKS, suggestFrameworks, type FrameworkId } from "@/lib/money/frameworks";
import { money } from "@/lib/onboarding/assessment";

/**
 * Pick a money framework: every card names its author/source, explains the idea in one line and — when income is
 * known — shows what each bucket means in VND for this family. Suggestions are tags; the family decides.
 */
export function FrameworkChooser({ profile, value, onChange }: { profile: FamilyProfile; value?: FrameworkId; onChange: (id: FrameworkId) => void }) {
  const income = profile.household?.monthlyIncome;
  const suggested = new Map(suggestFrameworks(profile).map((item) => [item.id, item.reason]));
  const ordered = [...FRAMEWORKS].sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)));
  return <div className="fw-list" role="radiogroup" aria-label="Phương pháp quản lý tiền">
    {ordered.map((fw) => {
      const on = value === fw.id;
      const reason = suggested.get(fw.id);
      return <article key={fw.id} className={`fw-card${on ? " on" : ""}`}>
        <button type="button" className="fw-head" role="radio" aria-checked={on} onClick={() => onChange(fw.id)}>
          <span className="fw-title"><b>{fw.name}</b>{reason && <span className="app-pill ok">Hợp với nhà bạn · {reason}</span>}</span>
          <small className="fw-origin">{fw.origin}</small>
          <span className="fw-idea">{fw.idea}</span>
          <span className="fw-mark" aria-hidden="true">{on ? "Đã chọn" : "Chọn"}</span>
        </button>
        {fw.buckets.some((bucket) => bucket.share !== undefined) && <ul className="fw-buckets">{fw.buckets.map((bucket) => <li key={bucket.key}>
          <b>{bucket.label}{bucket.share !== undefined ? ` ${Math.round(bucket.share * 100)}%` : ""}</b>
          {income && bucket.share !== undefined ? <em>≈ {money(income * bucket.share)}</em> : null}
          <small>{bucket.hint}</small>
        </li>)}</ul>}
        {fw.id === "baby-steps" && <p className="fw-note">Nhà mình đang ở {babyStep(profile).text}</p>}
        <details className="fw-more"><summary>Cách làm & hợp với ai</summary><ol>{fw.howTo.map((line) => <li key={line}>{line}</li>)}</ol><p>{fw.bestFor}</p></details>
      </article>;
    })}
  </div>;
}
