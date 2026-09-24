"use client";

import { childAgeMonths } from "@/lib/experience/profile-mapper";
import type { FamilyProfile } from "@/lib/experience/types";
import { CARE_METHOD_LIST, fitsAges, suggestCareMethods, type CareMethodId } from "@/lib/care/methods";

/**
 * Pick a parenting approach: each card names its author/source, the age range it is designed for and concrete
 * practices. Suggestions are tags; methods outside the children's age range are shown last and marked.
 */
export function CareMethodChooser({ profile, value, onChange }: { profile: FamilyProfile; value?: CareMethodId; onChange: (id: CareMethodId) => void }) {
  const ages = profile.children.map((child) => childAgeMonths(child)).filter((months): months is number => months !== undefined);
  const fitAges = ages.length ? ages : profile.household?.setup === "expecting" ? [0] : [];
  const suggested = new Map(suggestCareMethods(profile).map((item) => [item.id, item.reason]));
  const fits = (id: CareMethodId) => !fitAges.length || fitsAges(CARE_METHOD_LIST.find((item) => item.id === id)!, fitAges);
  const rank = (id: CareMethodId) => (suggested.has(id) ? 0 : fits(id) ? 1 : 2);
  const ordered = [...CARE_METHOD_LIST].sort((a, b) => rank(a.id) - rank(b.id));
  return <div className="fw-list" role="radiogroup" aria-label="Phương pháp nuôi dạy">
    {ordered.map((method) => {
      const on = value === method.id;
      const reason = suggested.get(method.id);
      return <article key={method.id} className={`fw-card${on ? " on" : ""}${fits(method.id) ? "" : " off-age"}`}>
        <button type="button" className="fw-head" role="radio" aria-checked={on} onClick={() => onChange(method.id)}>
          <span className="fw-title"><b>{method.name}</b><span className="app-pill">{method.ages.label}</span>{reason && <span className="app-pill ok">Hợp với nhà bạn · {reason}</span>}{!fits(method.id) && <span className="app-pill warn">Hợp khi con ở độ tuổi khác</span>}</span>
          <small className="fw-origin">{method.origin}</small>
          <span className="fw-idea">{method.idea}</span>
          <span className="fw-mark" aria-hidden="true">{on ? "Đã chọn" : "Chọn"}</span>
        </button>
        <details className="fw-more"><summary>Việc làm hằng ngày & hợp với ai</summary><ol>{method.practices.map((line) => <li key={line}>{line}</li>)}</ol><p>{method.bestFor}</p></details>
      </article>;
    })}
  </div>;
}
