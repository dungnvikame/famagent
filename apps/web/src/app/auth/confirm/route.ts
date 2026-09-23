import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const client = await createAuthClient();
  // "email": magic link / signup. "email_change": a guest linking an email (updateUser) — the
  // "Change email address" template must point here with type=email_change.
  const type = url.searchParams.get("type");
  if (tokenHash && client && (type === "email" || type === "email_change")) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/shop", url.origin));
  }
  // Default Supabase templates (free tier without custom SMTP cannot edit them) link to Supabase's verify
  // endpoint, which redirects here with a PKCE ?code= — same browser holds the code verifier cookie.
  const code = url.searchParams.get("code");
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/shop", url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirm", url.origin));
}
