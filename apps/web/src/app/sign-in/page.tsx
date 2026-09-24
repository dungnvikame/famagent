"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconCheck, IconShield } from "@/components/onboarding/icons";
import { createAuthBrowserClient } from "@/lib/supabase/browser";
import { getCaptchaToken } from "@/lib/supabase/captcha";

type Mode = "link" | "signin";

/**
 * One page, two moments: right after onboarding ("?after=onboarding") it is the account step that keeps the
 * profile (registration is mandatory before advice); otherwise it is plain sign-in for returning users.
 */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [anonymous, setAnonymous] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [afterOnboarding, setAfterOnboarding] = useState(false);
  const [configured, setConfigured] = useState(true);
  // Guests choose: save this profile under a new email (link, same user id) or sign in to an existing account.
  const [mode, setMode] = useState<Mode>("signin");
  const [sentMode, setSentMode] = useState<Mode>("signin");
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  /** Google via Supabase OAuth. Guests link Google to their current user so the onboarding profile is kept. */
  async function google() {
    const client = createAuthBrowserClient();
    if (!client) return;
    setError(""); setGoogleBusy(true);
    const redirectTo = `${location.origin}/auth/callback`;
    if (anonymous && mode === "link") {
      const { error: linkError } = await client.auth.linkIdentity({ provider: "google", options: { redirectTo } });
      if (!linkError) return; // browser is navigating to Google
      // Google account already has a FamAgent account: sign in to it instead (its own profile applies).
      if (linkError.code !== "identity_already_exists" && linkError.status !== 422) { setError("Chưa mở được đăng nhập Google. Vui lòng thử lại."); setGoogleBusy(false); return; }
    }
    const { error: authError } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (authError) { setError("Chưa mở được đăng nhập Google. Vui lòng thử lại."); setGoogleBusy(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const after = params.get("after") === "onboarding";
    setAfterOnboarding(after);
    if (params.get("error")) setError("Liên kết đã hết hạn hoặc không hợp lệ. Nhập email để nhận liên kết mới.");
    const client = createAuthBrowserClient();
    if (!client) { setConfigured(false); return; }
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => { if (session?.user && !session.user.is_anonymous) window.location.assign("/shop"); });
    void client.auth.getUser().then(({ data }) => {
      const guest = Boolean(data.user?.is_anonymous);
      setAnonymous(guest); setSignedIn(Boolean(data.user) && !guest);
      if (guest && (after || params.get("link") === "1")) setMode("link");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setState("sending");
    const client = createAuthBrowserClient();
    if (!client) { setError("Bản thử này chưa nối tài khoản."); setState("idle"); return; }
    const emailRedirectTo = `${location.origin}/auth/confirm`;
    if (anonymous && mode === "link") {
      const { error: linkError } = await client.auth.updateUser({ email }, { emailRedirectTo });
      if (linkError) {
        // Email already belongs to an account: offer signing in to it instead of a dead end.
        const exists = linkError.code === "email_exists" || linkError.status === 422;
        setError(exists ? "Email này đã có tài khoản. Chọn “Đăng nhập tài khoản đã có” để dùng hồ sơ trong tài khoản đó." : "Chưa gửi được email xác nhận. Vui lòng thử lại.");
        if (exists) setMode("signin");
        setState("idle"); return;
      }
    } else {
      const captchaToken = await getCaptchaToken().catch(() => null);
      if (captchaToken === null) { setError("Chưa xác minh được trình duyệt. Vui lòng tải lại trang và thử lại."); setState("idle"); return; }
      const { error: authError } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo, ...(captchaToken ? { captchaToken } : {}) } });
      if (authError) { setError("Chưa gửi được liên kết đăng nhập. Vui lòng thử lại."); setState("idle"); return; }
    }
    setSentMode(anonymous ? mode : "signin"); setState("sent");
  }

  const title = afterOnboarding ? "Tạo tài khoản để giữ hồ sơ" : signedIn ? "Bạn đã đăng nhập" : "Đăng nhập FamAgent";
  const lead = afterOnboarding
    ? "Để bắt đầu tư vấn, hãy xác nhận email của bạn. Hồ sơ vừa tạo sẽ được giữ trong tài khoản này trên mọi thiết bị. Không cần mật khẩu — chỉ một liên kết qua email."
    : "Nhận liên kết đăng nhập qua email. Hồ sơ gia đình, lịch sử tư vấn và sản phẩm đã lưu đi theo tài khoản.";

  return <main className="container account-page auth-page">
    <div className="auth-card">
      <span className="ob-orb ob-orb-lg" aria-hidden="true" />
      <p className="eyebrow accent">{afterOnboarding ? "Bước cuối" : "Tài khoản"}</p>
      <h1>{title}</h1>
      <p className="auth-lead">{lead}</p>

      {!configured && <div className="auth-note"><p>Bản thử này chạy trên trình duyệt, chưa cần tài khoản.</p><Link className="lp-cta" href="/shop">Vào tư vấn <span aria-hidden="true">→</span></Link></div>}

      {configured && signedIn && <div className="auth-note"><p><IconCheck size={16} /> Tài khoản của bạn đang hoạt động trên thiết bị này.</p><Link className="lp-cta" href="/shop">Vào tư vấn <span aria-hidden="true">→</span></Link><Link className="auth-secondary" href="/family">Xem hồ sơ gia đình</Link></div>}

      {configured && !signedIn && state === "sent" && <div className="auth-note" role="status">
        <p><IconCheck size={16} /> {sentMode === "link" ? <>Đã gửi email xác nhận đến <b>{email}</b>. Mở email và bấm <b>Xác nhận</b> — hồ sơ hiện tại được giữ nguyên trong tài khoản.</> : <>Đã gửi liên kết đến <b>{email}</b>. Mở email để tiếp tục.</>}</p>
        <p className="auth-hint">Không thấy email? Kiểm tra mục Spam/Quảng cáo, hoặc <button type="button" className="ob-inline-btn" onClick={() => setState("idle")}>gửi lại</button>.</p>
        <p className="auth-hint">Sau khi xác nhận, bạn sẽ được đưa thẳng vào phần tư vấn.</p>
      </div>}

      {configured && !signedIn && state !== "sent" && <button type="button" className="auth-google" onClick={() => void google()} disabled={googleBusy}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.9c-.3 2.2-1.7 5.4-4.9 7.6l7.5 5.8c4.5-4.1 7-10.2 7-17z"/><path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2 1.4-4.7 2.4-8.4 2.4-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        {googleBusy ? "Đang mở Google…" : afterOnboarding ? "Tiếp tục với Google" : "Đăng nhập với Google"}
      </button>}
      {configured && !signedIn && state !== "sent" && <p className="auth-or"><span>hoặc dùng email</span></p>}
      {configured && !signedIn && state !== "sent" && <form className="auth-form" onSubmit={submit}>
        {anonymous && (!afterOnboarding || mode === "signin") && <fieldset className="auth-modes"><legend className="ob-sr">Bạn muốn</legend>
          <label className={mode === "link" ? "on" : ""}><input type="radio" name="mode" checked={mode === "link"} onChange={() => setMode("link")} /> <span><b>Lưu hồ sơ đang có</b><small>Tạo tài khoản mới với email này</small></span></label>
          <label className={mode === "signin" ? "on" : ""}><input type="radio" name="mode" checked={mode === "signin"} onChange={() => setMode("signin")} /> <span><b>Đăng nhập tài khoản đã có</b><small>Dùng hồ sơ trong tài khoản đó</small></span></label>
        </fieldset>}
        <label className="auth-field"><span>Email của bạn</span><input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@vi-du.com" /></label>
        <button className="lp-cta" disabled={state === "sending"}>{state === "sending" ? "Đang gửi…" : afterOnboarding && mode === "link" ? "Tạo tài khoản & gửi liên kết" : "Gửi liên kết đăng nhập"} <span aria-hidden="true">→</span></button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!afterOnboarding && anonymous && mode === "link" && <p className="auth-hint">Đã có tài khoản? Chọn “Đăng nhập tài khoản đã có” ở trên.</p>}
      </form>}

      <p className="auth-privacy"><IconShield size={15} /> Không mật khẩu, không spam. Bạn xóa được tài khoản và toàn bộ dữ liệu ở trang Gia đình.</p>
    </div>
    <p className="auth-back"><Link href="/">← Về trang giới thiệu</Link></p>
  </main>;
}
