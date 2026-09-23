"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nextSlot, slotId, type ActiveSlot } from "@/lib/ai/onboarding/slots";
import { questionFor, quickRepliesFor } from "@/lib/ai/onboarding/templates";
import { cloudEnabled, loadCloudProfile, saveCloudProfile } from "@/lib/experience/cloud";
import { changedPaths } from "@/lib/experience/profile-meta";
import { getProfile, saveProfile, trackEvent } from "@/lib/experience/storage";
import type { FamilyProfile } from "@/lib/experience/types";
import { ensureSession } from "@/lib/supabase/browser";
import { FamilyContextPanel, type PendingValue } from "./family-context-panel";
import { OnboardingReview } from "./onboarding-review";
import { OnboardingThread, type Line } from "./onboarding-thread";

type Pending = PendingValue & { value: unknown };
type TurnResult = { profile: FamilyProfile; reply: string; quickReplies: string[]; activeSlot: string; pending: Pending[]; done: boolean; mode: "ai" | "rules" };

const GROUPS: Array<ActiveSlot["kind"]> = ["household", "child.basics", "child.care", "preferences", "home"];
const INTRO = "Chào bạn 👋 Mình là Family AI. Trước khi chọn đồ, mình muốn hiểu gia đình bạn một chút để gợi ý đúng size và ngân sách — khoảng 1–2 phút, câu nào chưa muốn trả lời cứ bỏ qua.";

const freshProfile = (): FamilyProfile => ({ id: crypto.randomUUID(), children: [], pricePreference: "balanced", aiConsent: false, updatedAt: new Date().toISOString() });
/** Typed shortcuts that finish: the whole message must be one of these (not a prefix like "bắt đầu từ tuần sau…"). */
const FINISH = /^(bắt đầu|tiếp tục|xong|ổn rồi|ok|không có gì thay đổi)[\s.!]*$/i;
const activeId = (slot: ActiveSlot) => slot.kind === "review" ? "review" : slotId(slot);

/** Opening lines for a profile: new visitors get the intro; returning ones resume where they left off. */
function openingLines(profile: FamilyProfile, updating: boolean): Line[] {
  const slot = nextSlot(profile);
  if (updating) return [{ role: "agent", text: "Đây là những gì mình đang nhớ về gia đình bạn. Bạn muốn cập nhật gì? Có thể nói tự nhiên, ví dụ “Gold giờ 11kg rồi”, hoặc sửa trực tiếp ở bảng bên cạnh.", slot: activeId(slot) }];
  return [{ role: "agent", text: INTRO }, { role: "agent", text: questionFor(slot, profile), slot: activeId(slot) }];
}

export function OnboardingAgent() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<"ai" | "rules">("rules");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  // Cloud mode only: null = no session could be created (anonymous sign-ins off, CAPTCHA, rate limit).
  const [session, setSession] = useState<{ anonymous: boolean } | null>(null);
  // True when the saved profile could not be loaded: server writes stay off so a partial profile
  // can never replace the real one (same guarantee as /api/onboarding for email accounts).
  const [remoteFailed, setRemoteFailed] = useState(false);

  function start(initial: FamilyProfile, updating: boolean) {
    const slot = nextSlot(initial);
    setProfile(initial); setLines(openingLines(initial, updating)); setPending([]); setFresh(new Set());
    setChips(updating ? ["Không có gì thay đổi"] : quickRepliesFor(slot)); setDone(slot.kind === "review");
  }

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
          current = await ensureSession(); // anonymous guest session (plan D5) so turns are saved and budgeted
          if (current) remote = await loadCloudProfile();
        } catch { if (current) setRemoteFailed(true); }
        if (cancelled) return;
        setSession(current);
        if (remote?.onboardedAt && !updateMode) { router.replace("/shop"); return; }
        initial = remote ?? (local?.onboardedAt ? null : local);
      } else if (local?.onboardedAt && !updateMode) {
        // The middleware gate cookie can expire while localStorage keeps the profile; refresh it or /shop bounces back here forever.
        document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
        router.replace("/shop"); return;
      }
      if (cancelled) return;
      start(initial ?? freshProfile(), updateMode);
      trackEvent(updateMode ? "family_profile_update_started" : "onboarding_started");
    }
    trackEvent("homepage_view");
    void load().catch(() => { if (!cancelled) start(getProfile() ?? freshProfile(), updateMode); });
    return () => { cancelled = true; };
  }, [router]);

  function persistLocal(next: FamilyProfile) { setProfile(next); saveProfile(next); }
  /** Email accounts are saved from the client (anonymous guests are saved by /api/onboarding each turn). */
  const canWriteServer = cloudEnabled && Boolean(session) && !remoteFailed;
  const saveForEmailUser = (next: FamilyProfile) => { if (canWriteServer && !session?.anonymous) void saveCloudProfile(next).catch(() => setError("Chưa lưu được thay đổi lên máy chủ.")); };

  function trackSlots(before: FamilyProfile, after: FamilyProfile) {
    const was = new Set([...(before.onboarding?.completedSlots ?? []), ...(before.onboarding?.skippedSlots ?? [])]);
    for (const id of after.onboarding?.completedSlots ?? []) if (!was.has(id)) trackEvent("onboarding_slot_filled", { slot: id.split(":")[0] });
    for (const id of after.onboarding?.skippedSlots ?? []) if (!was.has(id)) trackEvent("onboarding_slot_skipped", { slot: id.split(":")[0] });
  }

  async function send(text = message) {
    const value = text.trim();
    if (!profile || busy || !value) return;
    if (done && !pending.length && FINISH.test(value)) { void finish(); return; }
    setMessage(""); setError(""); setBusy(true);
    const history = lines.map((line) => ({ role: line.role === "agent" ? "assistant" as const : "user" as const, text: line.text, slot: line.slot }));
    setLines((items) => [...items, { role: "user", text: value }]);
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value, profile, history, pending }) });
      if (!response.ok) throw new Error(response.status === 400 ? "Câu trả lời quá dài hoặc chưa hợp lệ." : "Chưa ghi nhận được câu trả lời. Vui lòng thử lại.");
      const result = await response.json() as TurnResult;
      trackSlots(profile, result.profile);
      setFresh(changedPaths(profile, result.profile));
      persistLocal(result.profile); saveForEmailUser(result.profile);
      setPending(result.pending); setChips(result.quickReplies); setDone(result.done); setMode(result.mode);
      setLines((items) => [...items, { role: "agent", text: result.reply, slot: result.activeSlot }]);
    } catch (cause) {
      setLines((items) => items.slice(0, -1)); setMessage(value); // let the user retry without retyping
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
    } finally { setBusy(false); }
  }

  /** Inline edit from the context panel: already stamped + validated by the panel. */
  function edit(next: FamilyProfile, path: string) {
    if (!profile) return;
    setFresh(new Set([path])); persistLocal(next);
    // The user just typed this value: a stale confirmation for the same field must not overwrite it.
    const remaining = pending.filter((item) => item.path !== path);
    setPending(remaining);
    trackEvent("family_profile_updated", { source: "panel" });
    const slot = nextSlot(next);
    setDone(slot.kind === "review");
    if (!remaining.length) setChips(quickRepliesFor(slot));
    if (canWriteServer) void saveCloudProfile(next).catch(() => setError("Chưa lưu được thay đổi lên máy chủ."));
  }

  async function finish() {
    if (!profile || busy) return;
    // No server session: keep answers in this browser and sign in first; "/" resumes at review afterwards.
    if (cloudEnabled && !session) { router.push("/sign-in"); return; }
    if (remoteFailed) { setError("Chưa tải được hồ sơ đã lưu nên chưa thể lưu. Vui lòng tải lại trang."); return; }
    setBusy(true); setError("");
    const complete = { ...profile, onboardedAt: profile.onboardedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
      if (cloudEnabled) await saveCloudProfile(complete);
      persistLocal(complete);
      if (updating) trackEvent("family_profile_updated", { source: "agent" });
      else trackEvent("family_profile_created", { hasChild: complete.children.length > 0 });
      if (!updating) trackEvent("onboarding_completed", { durationSec: Math.round((Date.now() - startedAt.current) / 1000), turns: lines.filter((line) => line.role === "user").length, mode });
      document.cookie = "family-ai-onboarded=1; Path=/; SameSite=Lax; Max-Age=2592000";
      router.push("/shop");
    } catch { setError("Chưa lưu được hồ sơ. Vui lòng thử lại."); setBusy(false); }
  }

  function reset() {
    if (!window.confirm("Xóa thông tin vừa trả lời và bắt đầu lại?")) return;
    const blank = { ...freshProfile(), aiConsent: profile?.aiConsent ?? false };
    persistLocal(blank); start(blank, false);
    if (canWriteServer) void saveCloudProfile(blank).catch(() => {});
  }

  if (!profile) return <div className="ob-app ob-loading" aria-busy="true"><p>Đang chuẩn bị…</p></div>;
  const current = nextSlot(profile);
  // While a confirmation is open, progress stays on the group being confirmed.
  const waitingKind = pending.length ? lines.at(-1)?.slot?.split(":")[0] as ActiveSlot["kind"] | undefined : undefined;
  const shownKind = waitingKind && waitingKind !== "review" ? waitingKind : current.kind;
  const position = shownKind === "review" ? GROUPS.length : Math.max(0, GROUPS.indexOf(shownKind));
  const confirming = pending.length > 0 && lines.at(-1)?.role === "agent";

  return <div className="ob-app">
    <div className="ob-rail"><div className="agent-logo" aria-label="Family AI">f<span>.</span></div></div>
    <main className="ob-chat">
      <header className="ob-top">
        <span><span className="status-dot"/>Family AI đang lắng nghe</span>
        {cloudEnabled && (!session || session.anonymous) && <Link className="ob-signin" href="/sign-in">Đã có tài khoản? Đăng nhập</Link>}
        <span className="ob-progress" role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={GROUPS.length} aria-valuenow={position} aria-valuetext={shownKind === "review" ? "Đã xong" : `Nhóm ${position + 1} trên ${GROUPS.length}`}>
          {GROUPS.map((group, index) => <i key={group} className={index < position ? "on" : index === position ? "now" : ""}/>)}
          <em>{shownKind === "review" ? "Xong" : `${position + 1}/${GROUPS.length}`}</em>
        </span>
      </header>
      <OnboardingThread lines={lines} busy={busy} confirming={confirming} chips={done ? [] : chips} message={message} consent={profile.aiConsent}
        onMessage={setMessage} onSend={(value) => void send(value)} onConsent={(value) => persistLocal({ ...profile, aiConsent: value })}>
        {done && !pending.length && <OnboardingReview profile={profile} cloud={cloudEnabled} busy={busy} onStart={() => void finish()} onEdit={() => document.getElementById("ob-message")?.focus()} onReset={reset}/>}
      </OnboardingThread>
      {remoteFailed && <p className="ob-error" role="alert">Chưa tải được hồ sơ đã lưu. Thay đổi lúc này chỉ giữ trên trình duyệt. <button type="button" className="ob-inline-btn" onClick={() => window.location.reload()}>Tải lại</button></p>}
      {cloudEnabled && !session && <p className="ob-error" role="status">Chưa tạo được phiên để lưu trên máy chủ. Bạn vẫn có thể trả lời; câu trả lời được giữ trên trình duyệt này và cần <Link href="/sign-in">đăng nhập</Link> để lưu.</p>}
      {error && <p className="ob-error" role="alert">{error}</p>}
    </main>
    <FamilyContextPanel profile={profile} fresh={fresh} pending={pending} onEdit={edit} disabled={busy}/>
  </div>;
}
