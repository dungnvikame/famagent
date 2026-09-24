"use client";

import { IconCheck } from "@/components/onboarding/icons";
import { profileSummary } from "@/lib/ai/onboarding/templates";
import type { FamilyProfile } from "@/lib/experience/types";

/** Structured summary before entering /shop (mockup note 6). */
export function OnboardingReview({ profile, cloud, busy, onStart, onEdit, onReset }: {
  profile: FamilyProfile;
  cloud: boolean;
  busy: boolean;
  onStart: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return <section className="ob-review" aria-label="Tóm tắt hồ sơ gia đình">
    <div className="ob-review-head">
      <span className="ob-review-badge" aria-hidden="true"><IconCheck size={20} /></span>
      <div><h2>Mình đã hiểu gia đình bạn</h2><p>Kiểm tra nhanh trước khi bắt đầu — gợi ý sẽ dựa trên những điều này.</p></div>
    </div>
    <ul className="ob-review-list">{profileSummary(profile).map((line) => <li key={line}><IconCheck size={15} /> {line}</li>)}</ul>
    <div className="ob-review-actions">
      <button type="button" className="ob-btn primary" disabled={busy} onClick={onStart}>{busy ? "Đang lưu…" : "Xong, vào nhà mình →"}</button>
      <button type="button" className="ob-btn ghost" disabled={busy} onClick={onEdit}>Sửa thông tin</button>
      <button type="button" className="ob-btn danger" disabled={busy} onClick={onReset}>Xóa hết và làm lại</button>
    </div>
    <p className="ob-where">{cloud ? "Hồ sơ được lưu trên máy chủ cho phiên của bạn; đăng nhập bằng email để dùng trên thiết bị khác." : "Bản thử lưu trên trình duyệt này."} Bạn có thể sửa hoặc xóa bất cứ lúc nào ở trang Gia đình.</p>
  </section>;
}
