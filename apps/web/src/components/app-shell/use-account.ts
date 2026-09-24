"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

export interface AccountInfo {
  /** "local" = no Supabase configured (browser-only demo). */
  status: "loading" | "local" | "guest" | "member";
  name?: string;
  email?: string;
  avatarUrl?: string;
  /** e.g. "google" | "email" */
  provider?: string;
}

/** Google name/avatar (or email fallback) for the signed-in user, shared by the shell and the account section. */
function fromUser(user: User | null): AccountInfo {
  if (!user || user.is_anonymous) return { status: "guest" };
  const meta = user.user_metadata as Record<string, unknown>;
  const name = [meta.full_name, meta.name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const avatarUrl = [meta.avatar_url, meta.picture].find((value): value is string => typeof value === "string" && value.startsWith("https://"));
  return { status: "member", name: name ?? user.email?.split("@")[0], email: user.email ?? undefined, avatarUrl, provider: user.app_metadata?.provider };
}

export function useAccount(): AccountInfo {
  const [info, setInfo] = useState<AccountInfo>({ status: "loading" });
  useEffect(() => {
    const client = createAuthBrowserClient();
    if (!client) { setInfo({ status: "local" }); return; }
    void client.auth.getUser().then(({ data }) => setInfo(fromUser(data.user))).catch(() => setInfo({ status: "guest" }));
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => setInfo(fromUser(session?.user ?? null)));
    return () => subscription.subscription.unsubscribe();
  }, []);
  return info;
}
