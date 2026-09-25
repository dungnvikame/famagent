"use client";

import type { FamilyProfile } from "@/lib/experience/types";
import { babyStep, FRAMEWORKS, suggestFrameworks, type FrameworkId } from "@/lib/money/frameworks";
import { vnd } from "@/lib/catalog/format";

/**
 * Pick a money framework: every card names its author/source, explains the idea in one line and — when income is
 * known — shows what each bucket means in VND for this family. Suggestions are tags; the family decides.
 */
export function FrameworkChooser({ profile, value, onChange, onCustomize }: { profile: FamilyProfile; value?: FrameworkId; onChange: (id: FrameworkId) => void; /** Money page only: open the custom-split editor, blank or seeded from a framework. */ onCustomize?: (from: FrameworkId | "blank") => void }) {
  const income = profile.household?.monthlyIncome;
  const suggested = new Map(suggestFrameworks(profile).map((item) => [item.id, item.reason]));
  const ordered = [...FRAMEWORKS].sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)));
  return <div className="fw-list" role="radiogroup" aria-label="Phương pháp quản lý tiền">
    {onCustomize && <article className={`fw-card custom${value === "custom" ? " on" : ""}`}>
      <button type="button" className="fw-head" role="radio" aria-checked={value === "custom"} onClick={() => onCustomize(value === "custom" ? "custom" : "blank")}>
        <span className="fw-title"><b>Tự thiết kế theo nhà mình</b></span>
        <small className="fw-origin">Bạn đặt tên các phần, tỷ lệ % và nhóm chi nào thuộc phần nào</small>
        <span className="fw-idea">Ví dụ: Thiết yếu 50% · Cho con 15% · Để dành 20% · Hưởng thụ 10% · Biếu bố mẹ 5%. Có thể thêm nhóm chi riêng như “Sữa & bỉm”, “Đi lại”.</span>
        <span className="fw-mark" aria-hidden="true">{value === "custom" ? "Đang dùng · Chỉnh" : "Bắt đầu"}</span>
      </button>
    </article>}
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
          {income && bucket.share !== undefined ? <em>≈ {vnd(income * bucket.share)}</em> : null}
          <small>{bucket.hint}</small>
        </li>)}</ul>}
        {fw.id === "baby-steps" && <p className="fw-note">Nhà mình đang ở {babyStep(profile).text}</p>}
        {onCustomize && fw.buckets.every((bucket) => bucket.share !== undefined) && <p className="fw-note fw-customize">Muốn đổi tỷ lệ hoặc thêm phần? <button type="button" className="app-btn ghost" onClick={() => onCustomize(fw.id)}>Chỉnh theo nhà mình</button></p>}
        <details className="fw-more"><summary>Cách làm & hợp với ai</summary><ol>{fw.howTo.map((line) => <li key={line}>{line}</li>)}</ol><p>{fw.bestFor}</p></details>
      </article>;
    })}
  </div>;
}
