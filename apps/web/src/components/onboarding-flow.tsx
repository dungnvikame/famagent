"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyProfile } from "@/lib/experience/types";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import { cloudEnabled, loadCloudProfile, markPendingImport } from "@/lib/experience/cloud";

type Step = "child" | "preferences" | "review";
type Line = { role: "agent" | "user"; text: string };
const opening = "Chào bạn, tôi là Family AI. Tôi sẽ hỏi vài điều cần thiết để chọn đồ phù hợp với gia đình. Bé tên gì, hiện nặng khoảng bao nhiêu kg? Bạn có thể thêm tuổi hoặc size bỉm nếu biết.";

function freshProfile(): FamilyProfile { return { id: crypto.randomUUID(), children: [], pricePreference: "balanced", aiConsent: false, updatedAt: new Date().toISOString() }; }

export function OnboardingFlow() {
  const router = useRouter();
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [step, setStep] = useState<Step>("child");
  const [lines, setLines] = useState<Line[]>([{ role: "agent", text: opening }]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getProfile();
    if (cloudEnabled) {
      void loadCloudProfile().then((remote) => { if (remote?.onboardedAt) router.replace("/shop"); }).catch(() => {});
    } else if (saved?.onboardedAt) { router.replace("/shop"); return; }
    setProfile(cloudEnabled && saved?.onboardedAt ? freshProfile() : saved ?? freshProfile());
    if (saved?.children.length) {
      setStep("preferences");
      setLines([{ role: "agent", text: `Tôi đã nhớ thông tin của ${saved.children[0].name ? `bé ${saved.children[0].name}` : "bé"}. Khi mua đồ, bạn ưu tiên điều gì? Có mức giá tối đa thường dùng không?` }]);
    }
    trackEvent("homepage_view");
  }, [router]);

  async function send(value = message) {
    if (!profile || busy || step === "review" || !value.trim()) return;
    setBusy(true); setError(""); setMessage("");
    setLines((items) => [...items, { role: "user", text: value.trim() }]);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, message: value.trim(), profile }) });
      if (!response.ok) throw new Error("Không thể lưu câu trả lời. Vui lòng thử lại.");
      const result = await response.json() as { profile: FamilyProfile; reply: string; nextStep: Step };
      setProfile(result.profile); saveProfile(result.profile); setStep(result.nextStep);
      setLines((items) => [...items, { role: "agent", text: result.reply }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Đã có lỗi xảy ra."); }
    finally { setBusy(false); }
  }

  function finish() {
    if (!profile) return;
    const complete = { ...profile, onboardedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveProfile(complete); trackEvent("family_profile_created", { hasChild: complete.children.length > 0 });
    if (cloudEnabled) markPendingImport(complete.onboardedAt);
    document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
    router.push(cloudEnabled ? "/sign-in" : "/shop");
  }

  const child = profile?.children[0];
  return <div className="onboarding-shell"><section className="onboarding-intro"><div className="onboarding-intro-inner">
    <p className="eyebrow accent">TRỢ LÝ MUA SẮM CHO GIA ĐÌNH</p>
    <h1>Bắt đầu từ<br /><span>gia đình bạn.</span></h1>
    <p>Cho tôi biết điều gì quan trọng với bạn. Sau đó, chúng ta sẽ cùng tìm, so sánh và chọn sản phẩm phù hợp từ catalog.</p>
    <div className="intro-points"><div><b>01</b><span>Hiểu nhu cầu của bé</span></div><div><b>02</b><span>Ghi nhớ ưu tiên mua sắm</span></div><div><b>03</b><span>Đề xuất có lý do rõ ràng</span></div></div>
    <div className="privacy-card"><strong>Bạn kiểm soát thông tin của mình</strong><p>{cloudEnabled ? "Sau khi đăng nhập, hồ sơ được lưu trong tài khoản và có thể sửa hoặc xóa ở mục Gia đình." : "Bản trải nghiệm lưu hồ sơ trên trình duyệt này. Bạn có thể sửa hoặc xóa trong mục Gia đình."}</p></div>
  </div></section>
  <section className="onboarding-workspace"><div className="onboarding-top"><span className="agent-mark">✳</span><div><strong>Family AI</strong><small>Agent tìm hiểu gia đình</small></div><span className="step-count">{step === "child" ? "1 / 3" : step === "preferences" ? "2 / 3" : "3 / 3"}</span></div>
    <div className="progress-track"><span style={{ width: step === "child" ? "33%" : step === "preferences" ? "66%" : "100%" }} /></div>
    <div className="onboarding-content"><div className="conversation-lines" aria-live="polite">{lines.map((line, index) => <div className={`onboarding-line ${line.role}`} key={index}>{line.role === "agent" && <span className="agent-avatar">✳</span>}<p>{line.text}</p></div>)}</div>
      {step === "review" ? <div className="context-summary"><p className="eyebrow accent">BỐI CẢNH ĐÃ GHI NHẬN</p><h2>Đã sẵn sàng để bắt đầu</h2><div><span>Bé</span><strong>{child?.name || "Chưa cung cấp"}</strong></div><div><span>Cân nặng</span><strong>{child?.weightKg ? `${child.weightKg} kg` : "Có thể thêm sau"}</strong></div><div><span>Size bỉm</span><strong>{child?.diaperSize || "Chưa rõ"}</strong></div><div><span>Ưu tiên</span><strong>{profile?.pricePreference === "budget" ? "Giá tốt" : profile?.pricePreference === "premium" ? "Cao cấp" : "Cân bằng"}</strong></div><div><span>Ngân sách</span><strong>{profile?.maxBudget ? `${profile.maxBudget.toLocaleString("vi-VN")}đ` : "Linh hoạt"}</strong></div><button className="button primary full" onClick={finish}>Bắt đầu tư vấn <span aria-hidden="true">→</span></button><button className="link-button" onClick={() => { setStep("preferences"); setLines((items) => [...items, { role: "agent", text: "Bạn muốn điều chỉnh ưu tiên hoặc ngân sách như thế nào?" }]); }}>Chỉnh sửa ưu tiên</button></div> : <>
        <div className="quick-replies">{(step === "child" ? ["Dùng hồ sơ mẫu: Bé Gold, 10kg, 14 tháng, size L", "Tôi sẽ bổ sung sau"] : ["Ưu tiên chống tràn, dưới 400k", "Ưu tiên giá tốt", "Cân bằng, chưa có ngân sách"]).map((item) => <button key={item} onClick={() => send(item)} disabled={busy}>{item}</button>)}</div>
        <form className="onboarding-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}><input aria-label="Trả lời Family AI" placeholder={step === "child" ? "Ví dụ: Bé Gold 10kg, size L..." : "Ví dụ: Chống tràn, dưới 400k..."} value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy} /><button type="submit" disabled={busy || !message.trim()} aria-label="Gửi câu trả lời">→</button></form>
        {error && <p className="form-error">{error}</p>}
      </>}
      <label className="consent-line"><input type="checkbox" checked={profile?.aiConsent ?? false} onChange={(event) => profile && setProfile({ ...profile, aiConsent: event.target.checked })} /> Cho phép gửi câu hỏi mua sắm tôi nhập tới nhà cung cấp AI để hiểu yêu cầu tốt hơn. Không bật vẫn dùng được trải nghiệm theo quy tắc.</label>
    </div></section></div>;
}
