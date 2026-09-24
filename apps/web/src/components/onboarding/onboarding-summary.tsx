"use client";

import type { FamilyProfile } from "@/lib/experience/types";
import { starterSteps } from "@/lib/attention/starters";
import { familyPolicy, STYLE_LABELS } from "@/lib/policy/family-policy";
import { formatWeight } from "@/lib/onboarding/questions";

const FOCUS_LABELS: Record<string, string> = { money: "Quản lý tiền", shopping: "Quản lý mua sắm", replenish: "Giảm việc phải nhớ", care: "Chăm con", schedule: "Lịch" };

/** End of the 4-step onboarding: what FamAgent now knows, how it will work (Family Policy) and the first 3 steps. */
export function OnboardingSummary({ profile, busy, onStart, onEdit }: { profile: FamilyProfile; busy: boolean; onStart: () => void; onEdit: () => void }) {
  const policy = familyPolicy(profile);
  const kids = profile.children.map((child) => [child.name ? `bé ${child.name}` : "bé", child.weightKg ? formatWeight(child.weightKg) : null].filter(Boolean).join(", "));
  const focus = (profile.household?.focus ?? []).map((id) => FOCUS_LABELS[id]).filter(Boolean);
  const steps = starterSteps(profile, { transactions: 0, items: 0 });
  return <div className="ob-summary">
    <h2>Xong rồi! Đây là nhà mình</h2>
    <div className="app-card ob-summary-card">
      <p><b>Thành viên:</b> {profile.adultsCount ?? 2} người lớn{kids.length ? ` · ${kids.join(" · ")}` : ""}</p>
      {focus.length > 0 && <p><b>Ưu tiên:</b> {focus.join(", ")}</p>}
      <p><b>Phong cách:</b> {STYLE_LABELS[policy.style]}</p>
    </div>
    <h3>FamAgent sẽ làm việc thế này</h3>
    <ul className="ob-summary-list">{policy.lines.map((line) => <li key={line}>{line}</li>)}</ul>
    <h3>Bắt đầu bằng một trong ba việc</h3>
    <ol className="ob-summary-list">{steps.map((step) => <li key={step.id}><b>{step.title}</b> — {step.detail}</li>)}</ol>
    <p className="app-sub">Các bước này sẽ chờ bạn trên Trang chủ.</p>
    <span className="purchase-actions"><button type="button" className="app-btn" disabled={busy} onClick={onStart}>{busy ? "Đang lưu…" : "Bắt đầu"}</button><button type="button" className="ledger-link" onClick={onEdit}>Sửa câu trả lời</button></span>
  </div>;
}
