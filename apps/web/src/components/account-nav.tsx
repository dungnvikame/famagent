"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

/** Public-header account entry: "Đăng nhập" for visitors and guests, "Vào ứng dụng" for members; nothing in local mode. */
export function AccountNav() {
  const [state, setState] = useState<"unknown" | "guest" | "member" | "local">("unknown");
  useEffect(() => {
    const client = createAuthBrowserClient();
    if (!client) { setState("local"); return; }
    void client.auth.getUser().then(({ data }) => setState(data.user && !data.user.is_anonymous ? "member" : "guest")).catch(() => setState("guest"));
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => setState(session?.user && !session.user.is_anonymous ? "member" : "guest"));
    return () => subscription.subscription.unsubscribe();
  }, []);
  if (state === "unknown" || state === "local") return null;
  return state === "member" ? <Link href="/home">Vào ứng dụng</Link> : <Link href="/sign-in">Đăng nhập</Link>;
}
