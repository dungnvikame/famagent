"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyProfile } from "@/lib/experience/types";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import { cloudEnabled, loadCloudProfile, markPendingImport } from "@/lib/experience/cloud";

// Minimal client for the slot-filling onboarding agent (P3). The full agent UI arrives in P4.
type Line = { role: "agent" | "user"; text: string; slot?: string };
type Pending = { path: string; value: unknown; label: string };
type TurnResult = { profile: FamilyProfile; reply: string; quickReplies: string[]; activeSlot: string; pending: Pending[]; summary: string[]; done: boolean; mode: "ai" | "rules" };

const opening = "Chào bạn. Trước khi chọn đồ, mình muốn hiểu gia đình bạn một chút để gợi ý đúng size và ngân sách — khoảng 1–2 phút. Nhà mình có mấy người lớn và mấy bé?";
const openingChips = ["2 người lớn, 1 bé", "2 người lớn, 2 bé", "Bỏ qua"];

function freshProfile(): FamilyProfile { return { id: crypto.randomUUID(), children: [], pricePreference: "balanced", aiConsent: false, updatedAt: new Date().toISOString() }; }

export function AgentOnboarding() {
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(Date.now());
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [lines, setLines] = useState<Line[]>([{ role: "agent", text: opening, slot: "household" }]);
  const [chips, setChips] = useState<string[]>(openingChips);
  const [pending, setPending] = useState<Pending[]>([]);
  const [summary, setSummary] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getProfile();
    if (cloudEnabled) void loadCloudProfile().then((remote) => { if (remote?.onboardedAt) router.replace("/shop"); }).catch(() => {});
    else if (saved?.onboardedAt) { router.replace("/shop"); return; }
    setProfile(cloudEnabled && saved?.onboardedAt ? freshProfile() : saved ?? freshProfile());
    trackEvent("homepage_view");
    trackEvent("onboarding_started");
  }, [router]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [lines, done]);

  function finish() {
    if (!profile) return;
    const complete = { ...profile, onboardedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveProfile(complete);
    trackEvent("family_profile_created", { hasChild: complete.children.length > 0 });
    trackEvent("onboarding_completed", { durationSec: Math.round((Date.now() - startedAt.current) / 1000), turns: lines.filter((line) => line.role === "user").length });
    if (cloudEnabled) markPendingImport(complete.onboardedAt);
    document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
    router.push(cloudEnabled ? "/sign-in" : "/shop");
  }

  async function send(text = message) {
    const value = text.trim();
    if (!profile || busy || !value) return;
    if (done && !pending.length && /^(bắt đầu|tiếp tục|xong|ổn rồi|ok)/i.test(value)) { finish(); return; }
    setMessage(""); setError(""); setBusy(true);
    const history = lines.map((line) => ({ role: line.role === "agent" ? "assistant" as const : "user" as const, text: line.text, slot: line.slot }));
    setLines((items) => [...items, { role: "user", text: value }]);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value, profile, history, pending }) });
      if (!response.ok) throw new Error("Chưa ghi nhận được câu trả lời. Vui lòng thử lại.");
      const result = await response.json() as TurnResult;
      setProfile(result.profile); saveProfile(result.profile);
      setPending(result.pending); setChips(result.quickReplies); setSummary(result.summary); setDone(result.done);
      setLines((items) => [...items, { role: "agent", text: result.reply, slot: result.activeSlot }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."); }
    finally { setBusy(false); }
  }

  return <div className="agent-app onboarding-app">
    <div className="agent-rail"><div className="agent-logo" aria-label="Family AI">f<span>.</span></div><span className="rail-line"/><span className="rail-caption">FAMILY AI</span></div>
    <main className="agent-center">
      <div className="agent-header"><span className="agent-status"><span className="status-dot"/> Agent đang lắng nghe</span></div>
      <div className="agent-core onboarding-core">
        <p className="agent-overline">BẮT ĐẦU CÙNG FAMILY AI</p>
        <h1>{done ? "Mình đã hiểu gia đình bạn." : "Mình bắt đầu từ gia đình bạn."}</h1>
        <div className="agent-conversation" ref={threadRef} aria-live="polite">{lines.map((line, index) => <div className={`agent-line ${line.role}`} key={index}>{line.role === "agent" && <span className="agent-line-icon">✳</span>}<p>{line.text}</p></div>)}{busy && <div className="agent-line agent"><span className="agent-line-icon">✳</span><p>Đang ghi nhận...</p></div>}</div>
        {done && summary.length > 0 && <ul className="agent-summary">{summary.map((item) => <li key={item}>{item}</li>)}</ul>}
        {chips.length > 0 && <div className="agent-suggestions">{chips.map((chip) => <button key={chip} type="button" disabled={busy} onClick={() => chip === "Bắt đầu" ? finish() : void send(chip)}>{chip}<b>↗</b></button>)}</div>}
        <form className="agent-prompt" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor="onboard-message">Trả lời Family AI</label><textarea id="onboard-message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ví dụ: Bé Gold 10kg, 14 tháng, size L..." rows={2} disabled={busy}/><div className="agent-prompt-bottom"><span>Bạn có thể bỏ qua câu nào chưa muốn trả lời.</span><button disabled={busy || !message.trim()} aria-label="Gửi cho agent">Gửi <span>↗</span></button></div></form>
        {error && <p className="agent-error">{error}</p>}
        {done && <button className="agent-text-action" onClick={finish}>Bắt đầu tư vấn →</button>}
        <label className="agent-consent"><input type="checkbox" checked={profile?.aiConsent ?? false} onChange={(event) => profile && setProfile({ ...profile, aiConsent: event.target.checked })}/> Cho phép gửi câu trả lời của tôi tới nhà cung cấp AI (tên bé được thay bằng mã khi nhận ra được; nên tránh gửi thông tin nhận dạng khác). Không bật vẫn dùng được Family AI theo quy tắc.</label>
      </div>
      <div className="agent-bottom-note">{cloudEnabled ? "Hồ sơ sẽ được lưu trong tài khoản sau khi đăng nhập." : "Bản thử lưu hồ sơ trên trình duyệt này; bạn có thể sửa hoặc xóa sau."}</div>
    </main>
  </div>;
}
