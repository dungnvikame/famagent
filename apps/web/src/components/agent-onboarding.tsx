"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyProfile } from "@/lib/experience/types";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import { cloudEnabled, loadCloudProfile, markPendingImport } from "@/lib/experience/cloud";

type Step = "child" | "preferences" | "review";
type Line = { role: "agent" | "user"; text: string };
const opening = "Chào bạn. Trước khi chọn đồ, tôi muốn hiểu gia đình mình một chút. Bé tên gì, hiện nặng khoảng bao nhiêu kg? Bạn có thể cho tôi biết thêm tuổi hoặc size bỉm nếu nhớ.";

function freshProfile(): FamilyProfile { return { id: crypto.randomUUID(), children: [], pricePreference: "balanced", aiConsent: false, updatedAt: new Date().toISOString() }; }

export function AgentOnboarding() {
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [step, setStep] = useState<Step>("child");
  const [lines, setLines] = useState<Line[]>([{ role: "agent", text: opening }]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getProfile();
    if (cloudEnabled) void loadCloudProfile().then((remote) => { if (remote?.onboardedAt) router.replace("/shop"); }).catch(() => {});
    else if (saved?.onboardedAt) { router.replace("/shop"); return; }
    const initial = cloudEnabled && saved?.onboardedAt ? freshProfile() : saved ?? freshProfile();
    setProfile(initial);
    if (initial.children.length) {
      setStep("preferences");
      setLines([{ role: "agent", text: `Tôi đã nhớ ${initial.children[0].name ? `bé ${initial.children[0].name}` : "thông tin của bé"}. Khi chọn mua, bạn ưu tiên điều gì? Có ngân sách tối đa không?` }]);
    }
    trackEvent("homepage_view");
  }, [router]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [lines, step]);

  function finish() {
    if (!profile) return;
    const complete = { ...profile, onboardedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveProfile(complete); trackEvent("family_profile_created", { hasChild: complete.children.length > 0 });
    if (cloudEnabled) markPendingImport(complete.onboardedAt);
    document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
    router.push(cloudEnabled ? "/sign-in" : "/shop");
  }

  async function send() {
    const value = message.trim();
    if (!profile || busy || !value) return;
    setMessage(""); setError("");
    if (step === "review") {
      if (/bắt đầu|tiếp tục|xong|ổn rồi|đồng ý/i.test(value)) { finish(); return; }
      if (/sửa|đổi|chỉnh/i.test(value)) { setStep("preferences"); setLines((items) => [...items, { role: "user", text: value }, { role: "agent", text: "Bạn muốn chỉnh ưu tiên hoặc ngân sách thế nào? Nếu cần sửa cân nặng hay size, hãy nói rõ thông tin mới." }]); return; }
      setError("Bạn có thể nói ‘bắt đầu’ hoặc ‘sửa ngân sách’. "); return;
    }
    setBusy(true);
    setLines((items) => [...items, { role: "user", text: value }]);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, message: value, profile }) });
      if (!response.ok) throw new Error("Chưa ghi nhận được câu trả lời. Vui lòng thử lại.");
      const result = await response.json() as { profile: FamilyProfile; reply: string; nextStep: Step };
      setProfile(result.profile); saveProfile(result.profile); setStep(result.nextStep);
      setLines((items) => [...items, { role: "agent", text: result.reply }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."); }
    finally { setBusy(false); }
  }

  const child = profile?.children[0];
  return <div className="agent-app onboarding-app">
    <div className="agent-decoration one" aria-hidden="true"/><div className="agent-decoration two" aria-hidden="true"/>
    <div className="agent-rail"><div className="agent-logo" aria-label="Family AI">f<span>.</span></div><span className="rail-line"/><span className="rail-caption">FAMILY AI</span></div>
    <main className="agent-center">
      <div className="agent-header"><span className="agent-status"><span className="status-dot"/> Agent đang lắng nghe</span><span className="agent-step">{step === "child" ? "01" : step === "preferences" ? "02" : "03"} / 03</span></div>
      <div className="agent-core onboarding-core">
        <div className="agent-orbit" aria-hidden="true"><span>✳</span></div>
        <p className="agent-overline">BẮT ĐẦU CÙNG FAMILY AI</p>
        <h1>{step === "review" ? "Tôi đã hiểu gia đình mình." : step === "preferences" ? "Điều gì quan trọng với bạn?" : "Mình bắt đầu từ gia đình bạn."}</h1>
        <p className="agent-subtitle">{step === "review" ? "Xem lại những gì tôi đã ghi nhớ. Khi sẵn sàng, chỉ cần nói “bắt đầu”." : "Bạn chỉ cần trò chuyện. Tôi sẽ ghi nhớ bối cảnh và đưa nội dung cần xem tới đây."}</p>
        <div className="agent-conversation" ref={threadRef} aria-live="polite">{lines.map((line, index) => <div className={`agent-line ${line.role}`} key={index}>{line.role === "agent" && <span className="agent-line-icon">✳</span>}<p>{line.text}</p></div>)}{busy && <div className="agent-line agent"><span className="agent-line-icon">✳</span><p>Đang ghi nhận...</p></div>}</div>
        {step === "review" && <div className="agent-summary"><div><span>Bé</span><strong>{child?.name || "Chưa cung cấp"}</strong></div><div><span>Cân nặng / size</span><strong>{child?.weightKg ? `${child.weightKg} kg` : "Chưa rõ"} · {child?.diaperSize || "chưa rõ size"}</strong></div><div><span>Ngân sách</span><strong>{profile?.maxBudget ? `${profile.maxBudget.toLocaleString("vi-VN")}đ` : "Linh hoạt"}</strong></div></div>}
        <form className="agent-prompt" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor="onboard-message">{step === "review" ? "Nói “bắt đầu” hoặc điều muốn sửa" : "Trả lời Family AI"}</label><textarea id="onboard-message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={step === "child" ? "Ví dụ: Bé Gold 10kg, 14 tháng, size L..." : step === "preferences" ? "Ví dụ: Ưu tiên chống tràn, dưới 400k..." : "Bắt đầu tư vấn..."} rows={2} disabled={busy}/><div className="agent-prompt-bottom"><span>{step === "child" ? "Tên bé là tùy chọn. Bạn có thể bổ sung sau." : step === "preferences" ? "Nói điều bạn ưu tiên theo cách tự nhiên." : "Bạn có thể sửa thông tin sau trong cuộc trò chuyện."}</span><button disabled={busy || !message.trim()} aria-label="Gửi cho agent">Gửi <span>↗</span></button></div></form>
        {error && <p className="agent-error">{error}</p>}
        {step === "review" && <button className="agent-text-action" onClick={finish}>Bắt đầu tư vấn →</button>}
        <label className="agent-consent"><input type="checkbox" checked={profile?.aiConsent ?? false} onChange={(event) => profile && setProfile({ ...profile, aiConsent: event.target.checked })}/> Cho phép gửi câu hỏi mua sắm của tôi tới nhà cung cấp AI. Không bật vẫn dùng được Family AI theo quy tắc.</label>
      </div>
      <div className="agent-bottom-note">{cloudEnabled ? "Hồ sơ sẽ được lưu trong tài khoản sau khi đăng nhập." : "Bản thử lưu hồ sơ trên trình duyệt này; bạn có thể sửa hoặc xóa sau."}</div>
    </main>
  </div>;
}
