"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconSparkle, IconWallet } from "@/components/onboarding/icons";
import { profileSummary } from "@/lib/ai/onboarding/templates";
import type { FamilyProfile } from "@/lib/experience/types";
import { buildAssessment, type Assessment } from "@/lib/onboarding/assessment";

/**
 * End of onboarding: FamAgent's first read of the family — verdict, suggested money method, care plan by age and
 * three first steps. Rules render instantly; the AI-written opening note replaces the template when it arrives.
 */
export function OnboardingReview({ profile, cloud, busy, onStart, onEdit, onReset }: {
  profile: FamilyProfile;
  cloud: boolean;
  busy: boolean;
  onStart: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const [assessment, setAssessment] = useState<Assessment>(() => buildAssessment(profile));
  const [source, setSource] = useState<"rules" | "ai" | "loading">("loading");
  useEffect(() => {
    let cancelled = false;
    setAssessment(buildAssessment(profile)); setSource("loading");
    fetch("/api/onboarding/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile }) })
      .then((response) => response.ok ? response.json() as Promise<{ assessment: Assessment; source: "rules" | "ai" }> : Promise.reject())
      .then((result) => { if (!cancelled) { setAssessment(result.assessment); setSource(result.source); } })
      .catch(() => { if (!cancelled) setSource("rules"); });
    return () => { cancelled = true; };
    // Recompute only when the answers change, not on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(profile.household), JSON.stringify(profile.children)]);

  return <section className="ob-review ob-assess" aria-label="Nhận định và kế hoạch của FamAgent">
    <div className="ob-review-head">
      <span className="ob-orb" aria-hidden="true" />
      <div><p className="ob-assess-kicker">Nhận định của FamAgent</p><h2>{assessment.headline}</h2></div>
    </div>
    <p className="ob-assess-note" aria-live="polite">{assessment.note}{source === "loading" && <span className="ob-assess-typing"> · đang viết nhận định riêng cho nhà bạn…</span>}</p>

    <div className="ob-assess-block">
      <h3><IconWallet size={18} /> Quản lý tài chính: {assessment.finance.method}</h3>
      <p className="ob-assess-why">{assessment.finance.methodWhy}</p>
      {assessment.finance.points.length > 0 && <ul>{assessment.finance.points.map((point) => <li key={point}>{point}</li>)}</ul>}
    </div>

    {assessment.care.points.length > 0 && <div className="ob-assess-block">
      <h3><IconSparkle size={18} /> Kế hoạch chăm sóc các con</h3>
      <ul>{assessment.care.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </div>}

    <div className="ob-assess-block">
      <h3><IconCheck size={18} /> 3 việc nên làm trong tuần đầu</h3>
      <ol className="ob-assess-steps">{assessment.steps.map((step) => <li key={step.label}><b>{step.label}</b><small>{step.detail}</small></li>)}</ol>
    </div>

    <details className="ob-assess-answers"><summary>Xem lại câu trả lời của bạn</summary>
      <ul className="ob-review-list">{profileSummary(profile).map((line) => <li key={line}><IconCheck size={15} /> {line}</li>)}</ul>
    </details>

    <div className="ob-review-actions">
      <button type="button" className="ob-btn primary" disabled={busy} onClick={onStart}>{busy ? "Đang lưu…" : "Lưu kế hoạch và bắt đầu →"}</button>
      <button type="button" className="ob-btn ghost" disabled={busy} onClick={onEdit}>Sửa câu trả lời</button>
      <button type="button" className="ob-btn danger" disabled={busy} onClick={onReset}>Làm lại từ đầu</button>
    </div>
    <p className="ob-where">Đây là gợi ý để bắt đầu, không phải tư vấn tài chính hay y tế chuyên nghiệp. {cloud ? "Kế hoạch được lưu vào tài khoản của bạn ở bước tiếp theo." : "Bản thử lưu trên trình duyệt này."} Bạn sửa được mọi con số trong mục Tiền.</p>
  </section>;
}
