import { createBrowserClient } from "@supabase/ssr";

export function createAuthBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

/**
 * Guests get an anonymous Supabase user on first visit (plan D5) so onboarding can be
 * saved per turn and LLM turns are budgeted per user. Requires "Anonymous Sign-ins"
 * (and CAPTCHA before wider testing) in the Supabase project. Returns whether the
 * current session is anonymous; null when Supabase is not configured or sign-in failed.
 */
let inflight: Promise<{ anonymous: boolean } | null> | null = null;
export function ensureSession(): Promise<{ anonymous: boolean } | null> {
  // One request at a time: React StrictMode runs effects twice and must not create two guests.
  inflight ??= (async () => {
    const client = createAuthBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    if (data.user) return { anonymous: Boolean(data.user.is_anonymous) };
    // Until CAPTCHA is wired (plan P8), Supabase's per-IP limit on anonymous sign-ins applies.
    const { data: created, error } = await client.auth.signInAnonymously();
    return error || !created.user ? null : { anonymous: true };
  })().finally(() => { inflight = null; });
  return inflight;
}

/** True when the signed-in user is an anonymous guest (used to invite email linking). */
export async function isAnonymousUser(): Promise<boolean> {
  const client = createAuthBrowserClient();
  if (!client) return false;
  const { data } = await client.auth.getUser();
  return Boolean(data.user?.is_anonymous);
}
