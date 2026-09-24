"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildQuestions, markQuestion, OTHER_PREFIX, type Question } from "@/lib/onboarding/questions";
import { cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { stampChanges } from "@/lib/experience/profile-meta";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { validProfile } from "@/lib/experience/validate";
import { ensureSession } from "@/lib/supabase/browser";
import { FamilyContextPanel } from "./family-context-panel";
import { IconCheck } from "./icons";
import { OnboardingReview } from "./onboarding-review";

// AI is the product's core value, so new profiles start opted in; the review switch and /family let people opt out.
const freshProfile = (): FamilyProfile => ({ id: crypto.randomUUID(), children: [], pricePreference: "balanced", aiConsent: true, updatedAt: new Date().toISOString() });
const GROUPS = ["Mục tiêu", "Gia đình", "Các con", "Nhà ở", "Tiền"] as const;
/** Short pause so the tapped choice visibly registers before the next question (≤ 300 ms). */
const ADVANCE_MS = 220;

/** Tap-to-answer onboarding: one question at a time, big choice cards, back/skip always available. */
export function OnboardingWizard() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  // "Khác — tự nhập": free-text answer next to the choices.
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [session, setSession] = useState<{ anonymous: boolean } | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // One advance per question: a second tap during the short confirm pause must not skip the next question.
  const advancing = useRef(false);

  useEffect(() => {
    const updateMode = new URLSearchParams(window.location.search).get("update") === "1";
    setUpdating(updateMode);
    let cancelled = false;
    async function load() {
      const local = getProfile();
      let initial = local;
      if (cloudEnabled) {
        let current: { anonymous: boolean } | null = null;
        let remote: FamilyProfile | null = null;
        try {
          current = await ensureSession(); // anonymous guest session (plan D5)
          if (current) remote = await loadCloudProfile();
        } catch { if (current) setRemoteFailed(true); }
        if (cancelled) return;
        setSession(current);
        if (remote?.onboardedAt && !updateMode) { router.replace("/home"); return; }
        initial = remote ?? (local?.onboardedAt ? null : local);
      } else if (local?.onboardedAt && !updateMode) {
        // The middleware gate cookie can expire while localStorage keeps the profile; refresh it or /shop bounces back here forever.
        document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
        router.replace("/home"); return;
      }
      if (cancelled) return;
      setProfile(initial && validProfile(initial) ? initial : freshProfile());
      trackEvent(updateMode ? "family_profile_update_started" : "onboarding_started");
    }
    void load().catch(() => { if (!cancelled) setProfile(freshProfile()); });
    return () => { cancelled = true; };
  }, [router]);

  const questions = useMemo(() => profile ? buildQuestions(profile) : [], [profile]);
  const question: Question | undefined = questions[index];
  const reviewing = Boolean(profile) && index >= questions.length;

  // Pre-select the stored answer whenever the question changes (back/forward and update mode).
  useEffect(() => {
    if (!profile || !question) return;
    const current = question.current(profile);
    advancing.current = false;
    const typed = current.find((value) => value.startsWith(OTHER_PREFIX))?.slice(OTHER_PREFIX.length) ?? "";
    setPicked(current.filter((value) => !value.startsWith(OTHER_PREFIX))); setOtherOn(Boolean(typed)); setOtherText(typed);
    setText(question.mode === "text" ? current[0] ?? "" : ""); setError("");
    // Keyboard/screen-reader users land on the new question.
    titleRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per question, not per profile edit
  }, [question?.id]);

  function persist(next: FamilyProfile) { setProfile(next); saveProfile(next); }

  function answer(values: string[]) {
    if (!profile || !question) return;
    const applied = markQuestion(question.apply(profile, values), question.id, false);
    const next = stampChanges(profile, { ...applied, updatedAt: new Date().toISOString() }, "user_entered");
    if (!validProfile(next)) { setError("Giá trị chưa hợp lệ, bạn chọn lại giúp mình nhé."); return; }
    persist(next);
    trackEvent("onboarding_slot_filled", { slot: question.id.split(":")[0] });
    setIndex((value) => value + 1);
  }

  function skip() {
    if (!profile || !question) return;
    persist(markQuestion(profile, question.id, true));
    trackEvent("onboarding_slot_skipped", { slot: question.id.split(":")[0] });
    setIndex((value) => value + 1);
  }

  function choose(value: string) {
    if (!question || busy) return;
    if (question.mode === "multi") {
      // "none" is exclusive with the real options.
      if (value === "none") setOtherOn(false);
      setPicked((current) => value === "none" ? ["none"] : current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== "none"), value]);
      return;
    }
    if (advancing.current) return;
    advancing.current = true;
    setOtherOn(false);
    setPicked([value]);
    window.setTimeout(() => answer([value]), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ADVANCE_MS);
  }

  /** Values to submit for the current choice question, with the typed "Khác" answer when present. */
  const withTyped = () => [...picked, ...(otherOn && otherText.trim() ? [OTHER_PREFIX + otherText.trim()] : [])];
  const canContinue = picked.length > 0 || (otherOn && otherText.trim().length > 0);

  function edit(next: FamilyProfile) { persist(next); if (cloudEnabled && session && !remoteFailed) void saveCloudProfile(next).catch(() => setError("Chưa lưu được thay đổi lên máy chủ.")); }

  async function finish() {
    if (!profile || busy) return;
    if (cloudEnabled && !session) { router.push("/sign-in"); return; }
    if (remoteFailed) { setError("Chưa tải được hồ sơ đã lưu nên chưa thể lưu. Vui lòng tải lại trang."); return; }
    setBusy(true); setError("");
    const complete = { ...profile, onboardedAt: profile.onboardedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
      if (cloudEnabled) await saveCloudProfile(complete);
      persist(complete);
      if (updating) trackEvent("family_profile_updated", { source: "wizard" });
      else {
        trackEvent("family_profile_created", { hasChild: complete.children.length > 0 });
        trackEvent("onboarding_completed", { durationSec: Math.round((Date.now() - startedAt.current) / 1000), answered: complete.onboarding?.completedSlots.length ?? 0, mode: "choices" });
      }
      document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
      // First-time guests go to the account step (keeps the profile across devices); members and updates go straight to advice.
      router.push(cloudEnabled && session?.anonymous && !updating ? "/sign-in?after=onboarding" : "/home");
    } catch { setError("Chưa lưu được hồ sơ. Vui lòng thử lại."); setBusy(false); }
  }

  if (!profile) return <div className="ob-app ob-loading" aria-busy="true"><p>Đang chuẩn bị…</p></div>;
  const groupIndex = reviewing ? GROUPS.length : GROUPS.indexOf(question!.group);
  const total = questions.length;

  return <div className="ob-app ob-wizard">
    <div className="ob-rail"><Link className="agent-logo" href="/" aria-label="Về trang giới thiệu FamAgent">f<span>.</span></Link></div>
    <main className="ob-chat">
      <header className="ob-top">
        <span className="ob-who"><span className="ob-orb" aria-hidden="true"/><span><b>FamAgent</b><small>{updating ? "Cập nhật hồ sơ" : "Làm quen với gia đình bạn"}</small></span></span>
        <span className="ob-progress" role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)} aria-valuetext={reviewing ? "Đã xong" : `Câu ${index + 1} trên ${total}`}>
          {GROUPS.map((group, position) => <i key={group} className={position < groupIndex ? "on" : position === groupIndex ? "now" : ""}/>)}
          <em>{reviewing ? "Nhận định & kế hoạch" : <>Câu {index + 1}/{total} · <b>{question!.group}</b></>}</em>
        </span>
      </header>
      <div className="ob-stage">
        {reviewing
          ? <div className="ob-step" key="review">
              <OnboardingReview profile={profile} cloud={cloudEnabled} busy={busy} onStart={() => void finish()} onEdit={() => setIndex(0)} onReset={() => { if (window.confirm("Xóa các câu trả lời và bắt đầu lại?")) { persist({ ...freshProfile(), aiConsent: profile.aiConsent }); setIndex(0); } }}/>
              <label className="ob-consent ob-consent-card">
                <input type="checkbox" role="switch" checked={profile.aiConsent} onChange={(event) => persist({ ...profile, aiConsent: event.target.checked })}/>
                <span className="ob-consent-text"><span><b>Dùng AI để hiểu câu hỏi của bạn tốt hơn.</b> Tên bé được thay bằng mã khi nhận ra được. Tắt vẫn dùng được theo quy tắc.</span></span>
              </label>
            </div>
          : <section className="ob-step" key={question!.id} aria-labelledby="ob-q-title">
              <div className="ob-ask"><span className="ob-orb" aria-hidden="true"/><div>
                <h1 id="ob-q-title" ref={titleRef} tabIndex={-1}>{question!.title}</h1>
                {question!.help && <p>{question!.help}</p>}
              </div></div>
              {question!.mode === "text"
                ? <form className="ob-text" onSubmit={(event) => { event.preventDefault(); if (text.trim()) answer([text]); else skip(); }}>
                    <label htmlFor="ob-text-input" className="ob-sr">{question!.title}</label>
                    <input id="ob-text-input" value={text} maxLength={40} autoComplete="off" placeholder="Ví dụ: Gold, Bin, Na…" onChange={(event) => setText(event.target.value)} />
                    <button type="submit" className="ob-btn primary">{text.trim() ? "Tiếp tục" : "Bỏ qua"}</button>
                  </form>
                : <div className={`ob-options${question!.choices.length > 4 ? " many" : ""}`} role={question!.mode === "multi" ? "group" : "radiogroup"} aria-labelledby="ob-q-title">
                    {question!.choices.map((choice) => {
                      const on = picked.includes(choice.value);
                      return <button type="button" key={choice.value} className={`ob-option${on ? " on" : ""}`} role={question!.mode === "multi" ? "checkbox" : "radio"} aria-checked={on} disabled={busy} onClick={() => choose(choice.value)}>
                        <span className="ob-option-text"><b>{choice.label}</b>{choice.hint && <small>{choice.hint}</small>}</span>
                        <span className="ob-option-mark" aria-hidden="true">{on && <IconCheck size={14} />}</span>
                      </button>;
                    })}
                    {question!.other && <button type="button" className={`ob-option other${otherOn ? " on" : ""}`} role={question!.mode === "multi" ? "checkbox" : "radio"} aria-checked={otherOn} disabled={busy} onClick={() => { const next = !otherOn; setOtherOn(next); if (next && question!.mode === "single") setPicked([]); if (next && question!.mode === "multi") setPicked((current) => current.filter((item) => item !== "none")); }}>
                      <span className="ob-option-text"><b>Khác — tự nhập</b><small>trả lời theo cách của bạn</small></span>
                      <span className="ob-option-mark" aria-hidden="true">{otherOn && <IconCheck size={14} />}</span>
                    </button>}
                  </div>}
              {question!.other && otherOn && <form className="ob-other" onSubmit={(event) => { event.preventDefault(); if (canContinue) answer(withTyped()); }}>
                <label htmlFor="ob-other-input" className="ob-sr">Câu trả lời của bạn</label>
                <input id="ob-other-input" autoFocus value={otherText} maxLength={120} autoComplete="off" placeholder={question!.other.placeholder} onChange={(event) => setOtherText(event.target.value)} />
              </form>}
              {question!.exact && <details className="ob-exact"><summary>Biết số cân chính xác? Nhập ở đây</summary>
                <form onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("exact"); if (value) answer([String(value)]); }}>
                  <label htmlFor="ob-exact-input" className="ob-sr">Cân nặng chính xác (kg)</label>
                  <input id="ob-exact-input" name="exact" type="number" inputMode="decimal" min={question!.exact.min} max={question!.exact.max} step={question!.exact.step} placeholder="Ví dụ: 10.5" />
                  <span>{question!.exact.unit}</span><button type="submit" className="ob-btn ghost">Lưu</button>
                </form>
              </details>}
              {error && <p className="ob-error" role="alert">{error}</p>}
              <div className="ob-nav">
                <button type="button" className="ob-link-btn" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>← Quay lại</button>
                <span>
                  {question!.mode !== "text" && <button type="button" className="ob-link-btn" onClick={skip}>Bỏ qua</button>}
                  {(question!.mode === "multi" || (question!.other && otherOn)) && <button type="button" className="ob-btn primary" disabled={!canContinue} onClick={() => answer(withTyped())}>Tiếp tục</button>}
                </span>
              </div>
            </section>}
        {remoteFailed && <p className="ob-error" role="alert">Chưa tải được hồ sơ đã lưu. Thay đổi lúc này chỉ giữ trên trình duyệt. <button type="button" className="ob-inline-btn" onClick={() => window.location.reload()}>Tải lại</button></p>}
        {cloudEnabled && !session && <p className="ob-error" role="status">Chưa tạo được phiên để lưu trên máy chủ. Bạn vẫn có thể trả lời; cần <Link href="/sign-in">đăng nhập</Link> để lưu.</p>}
      </div>
    </main>
    <FamilyContextPanel profile={profile} onEdit={edit} disabled={busy} title="FamAgent đang hiểu" general/>
  </div>;
}
