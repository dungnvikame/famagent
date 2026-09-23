"use client";

import { useState } from "react";
import Link from "next/link";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setState("sending");
    const client = createAuthBrowserClient();
    if (!client) { setError("Chưa cấu hình đăng nhập Supabase."); setState("idle"); return; }
    const { error: authError } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/confirm` } });
    if (authError) { setError("Chưa gửi được liên kết đăng nhập. Vui lòng thử lại."); setState("idle"); return; }
    setState("sent");
  }
  return <main className="container account-page"><div className="account-heading"><p className="eyebrow accent">TÀI KHOẢN FAMILY AI</p><h1>Đăng nhập để lưu hành trình mua sắm</h1><p>Hồ sơ gia đình, lịch sử tư vấn và sản phẩm đã lưu sẽ được giữ trong tài khoản của bạn.</p></div><div className="form-card sign-in-card"><div><h2>Nhận liên kết qua email</h2><p>Nhập email của bạn. Chúng tôi sẽ gửi một liên kết đăng nhập.</p></div>{state === "sent" ? <p>Đã gửi liên kết đến {email}. Hãy mở email để tiếp tục.</p> : <form onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@vi-du.com" /></label><button className="button primary" disabled={state === "sending"}>{state === "sending" ? "Đang gửi..." : "Gửi liên kết đăng nhập"}</button></form>}{error && <p className="form-error">{error}</p>}</div><Link href="/">← Quay lại</Link></main>;
}
