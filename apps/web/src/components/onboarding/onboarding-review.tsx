"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconShield, IconSparkle, IconWallet } from "@/components/onboarding/icons";
import { HEALTH_LABELS } from "@/lib/money/health";
import { profileSummary } from "@/lib/ai/onboarding/templates";
import type { FamilyProfile } from "@/lib/experience/types";
import { buildAssessment, type Assessment } from "@/lib/onboarding/assessment";
import { FrameworkChooser } from "@/components/money/framework-chooser";
import type { FrameworkId } from "@/lib/money/frameworks";
import { CareMethodChooser } from "@/components/care/care-method-chooser";
import type { CareMethodId } from "@/lib/care/methods";

/**
 * End of onboarding: FamAgent's first read of the family — verdict, money situation, a choice of well-known money
 * frameworks (the family picks), care plan by age and three first steps. Rules render instantly; the AI-written opening note replaces the template when it arrives.
 */
export function OnboardingReview({ profile, cloud, busy, onStart, onEdit, onReset, onMethod, onCareMethod }: {
  profile: FamilyProfile;
  onMethod: (id: FrameworkId) => void;
  onCareMethod: (id: CareMethodId) => void;
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
  }, [JSON.stringify({ ...profile.household, moneyMethod: undefined, careMethod: undefined }), JSON.stringify(profile.children)]);

  return <section className="ob-review ob-assess" aria-label="Nhận định và kế hoạch của FamAgent">
    <div className="ob-review-head">
      <span className="ob-orb" aria-hidden="true" />
      <div><p className="ob-assess-kicker">Nhận định của FamAgent</p><h2>{assessment.headline}</h2></div>
    </div>
    <p className="ob-assess-note" aria-live="polite">{assessment.note}{source === "loading" && <span className="ob-assess-typing"> · đang viết nhận định riêng cho nhà bạn…</span>}</p>

    {assessment.finance.points.length > 0 && <div className="ob-assess-block">
      <h3><IconWallet size={18} /> Tình hình tài chính</h3>
      <ul>{assessment.finance.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </div>}

    {assessment.health.score !== undefined && <div className="ob-assess-block fh-block">
      <h3><IconShield size={18} /> Sức khỏe tài chính: {assessment.health.score}/100 · {HEALTH_LABELS[assessment.health.tier!]}</h3>
      <p className="ob-assess-why">Theo bộ 8 chỉ số FinHealth (Financial Health Network) — chia thành Chi tiêu, Tiết kiệm, Vay nợ, Kế hoạch.</p>
      <ul className="fh-grid">{assessment.health.indicators.map((item) => <li key={item.key} className={`fh-item ${item.status}`}>
        <span className="fh-pillar">{item.pillar}</span><b>{item.label}</b>
        <span className="fh-status">{item.status === "unknown" ? "Chưa rõ" : HEALTH_LABELS[item.status]}</span>
        <small>{item.finding}</small>
      </li>)}</ul>
    </div>}

    {assessment.health.problems.length > 0 && <div className="ob-assess-block">
      <h3><IconWallet size={18} /> Vấn đề cần xử lý & cách xử lý</h3>
      <ol className="fh-problems">{assessment.health.problems.map((item) => <li key={item.key} className={item.status}>
        <b>{item.problem}</b><span>→ {item.fix}</span>
      </li>)}</ol>
    </div>}

    <div className="ob-assess-block">
      <h3><IconWallet size={18} /> Chọn cách quản lý tiền cho nhà mình</h3>
      <p className="ob-assess-why">Đây là những phương pháp được nhiều gia đình trên thế giới áp dụng. Chọn một cách bạn thấy hợp — đổi lại lúc nào cũng được trong mục Tiền.</p>
      <FrameworkChooser profile={profile} value={profile.household?.moneyMethod} onChange={onMethod} />
    </div>

    {assessment.careCheck.score !== undefined && <div className="ob-assess-block fh-block">
      <h3><IconSparkle size={18} /> Chăm sóc các con: {assessment.careCheck.score}/100 · {HEALTH_LABELS[assessment.careCheck.tier!]}</h3>
      <p className="ob-assess-why">Theo Khung Chăm sóc Nuôi dưỡng của WHO, UNICEF và Ngân hàng Thế giới (2018) — 5 thành phần: Sức khỏe, Dinh dưỡng, Chăm sóc đáp ứng, Học sớm, An toàn.</p>
      <ul className="fh-grid">{assessment.careCheck.indicators.map((item) => <li key={item.key} className={`fh-item ${item.status}`}>
        <span className="fh-pillar">{item.component}</span><b>{item.label}</b>
        <span className="fh-status">{item.status === "unknown" ? "Chưa rõ" : HEALTH_LABELS[item.status]}</span>
        <small>{item.finding}</small>
      </li>)}</ul>
    </div>}

    {assessment.careCheck.problems.length > 0 && <div className="ob-assess-block">
      <h3><IconSparkle size={18} /> Điều cần cải thiện khi chăm con & cách làm</h3>
      <ol className="fh-problems">{assessment.careCheck.problems.map((item) => <li key={item.key} className={item.status}>
        <b>{item.problem}</b><span>→ {item.fix}</span>
      </li>)}</ol>
    </div>}

    {assessment.care.points.length > 0 && <div className="ob-assess-block">
      <h3><IconSparkle size={18} /> Việc cần theo dõi theo độ tuổi</h3>
      <ul>{assessment.care.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </div>}

    {(profile.children.length > 0 || profile.household?.setup === "expecting") && <div className="ob-assess-block">
      <h3><IconSparkle size={18} /> Chọn phương pháp nuôi dạy cho nhà mình</h3>
      <p className="ob-assess-why">Những phương pháp được nhiều gia đình trên thế giới áp dụng. Chọn một cách bạn thấy hợp — FamAgent sẽ nhắc các việc hằng ngày của phương pháp đó; đổi lại được trong mục Gia đình.</p>
      <CareMethodChooser profile={profile} value={profile.household?.careMethod} onChange={onCareMethod} />
    </div>}

    <div className="ob-assess-block">
      <h3><IconCheck size={18} /> 3 việc nên làm trong tuần đầu</h3>
      <ol className="ob-assess-steps">{assessment.steps.map((step) => <li key={step.label}><b>{step.label}</b><small>{step.detail}</small></li>)}</ol>
    </div>

    <details className="ob-assess-answers"><summary>Xem lại câu trả lời của bạn</summary>
      <ul className="ob-review-list">{profileSummary(profile).map((line) => <li key={line}><IconCheck size={15} /> {line}</li>)}</ul>
    </details>

    <div className="ob-review-actions">
      <button type="button" className="ob-btn primary" disabled={busy} onClick={onStart}>{busy ? "Đang lưu…" : profile.household?.moneyMethod ? "Lưu kế hoạch và bắt đầu →" : "Bắt đầu, chọn phương pháp sau →"}</button>
      <button type="button" className="ob-btn ghost" disabled={busy} onClick={onEdit}>Sửa câu trả lời</button>
      <button type="button" className="ob-btn danger" disabled={busy} onClick={onReset}>Làm lại từ đầu</button>
    </div>
    <p className="ob-where">Đây là gợi ý để bắt đầu, không phải tư vấn tài chính hay y tế chuyên nghiệp. {cloud ? "Kế hoạch được lưu vào tài khoản của bạn ở bước tiếp theo." : "Bản thử lưu trên trình duyệt này."} Bạn sửa được mọi con số trong mục Tiền.</p>
  </section>;
}
