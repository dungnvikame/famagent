"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAuthBrowserClient } from "@/lib/supabase/browser";
import { getCaptchaToken } from "@/lib/supabase/captcha";

type Mode = "link" | "signin";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [anonymous, setAnonymous] = useState(false);
  // Guests choose: save this profile under a new email (link, same user id) or sign in to an existing account.
  const [mode, setMode] = useState<Mode>("signin");
  const [sentMode, setSentMode] = useState<Mode>("signin");
  const [error, setError] = useState("");

  useEffect(() => {
    const client = createAuthBrowserClient();
    if (!client) return;
    void client.auth.getUser().then(({ data }) => {
      const guest = Boolean(data.user?.is_anonymous);
      setAnonymous(guest);
      if (guest && new URLSearchParams(window.location.search).get("link") === "1") setMode("link");
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setState("sending");
    const client = createAuthBrowserClient();
    if (!client) { setError("Chưa cấu hình đăng nhập Supabase."); setState("idle"); return; }
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

  const sentText = sentMode === "link"
    ? `Đã gửi email xác nhận đến ${email}. Sau khi xác nhận, hồ sơ hiện tại được giữ nguyên trong tài khoản.`
    : `Đã gửi liên kết đến ${email}. Hãy mở email để tiếp tục.`;
  return <main className="container account-page"><div className="account-heading"><p className="eyebrow accent">TÀI KHOẢN FAMILY AI</p><h1>Đăng nhập hoặc lưu hồ sơ bằng email</h1><p>Hồ sơ gia đình, lịch sử tư vấn và sản phẩm đã lưu được giữ trong tài khoản để dùng trên thiết bị khác.</p></div>
    <div className="form-card sign-in-card"><div><h2>Nhận liên kết qua email</h2><p>Nhập email của bạn. Chúng tôi sẽ gửi một liên kết.</p></div>
      {state === "sent" ? <p>{sentText}</p> : <form onSubmit={submit}>
        {anonymous && <fieldset className="sign-in-mode"><legend>Bạn muốn</legend>
          <label className="consent-line"><input type="radio" name="mode" checked={mode === "link"} onChange={() => setMode("link")} /> Lưu hồ sơ đang có bằng email mới</label>
          <label className="consent-line"><input type="radio" name="mode" checked={mode === "signin"} onChange={() => setMode("signin")} /> Đăng nhập tài khoản đã có (dùng hồ sơ trong tài khoản; thông tin vừa nhập chỉ được dùng nếu tài khoản chưa có hồ sơ)</label>
        </fieldset>}
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@vi-du.com" /></label>
        <button className="button primary" disabled={state === "sending"}>{state === "sending" ? "Đang gửi..." : "Gửi liên kết"}</button>
      </form>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><Link href="/">← Quay lại</Link></main>;
}
