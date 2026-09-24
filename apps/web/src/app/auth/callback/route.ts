import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const client = await createAuthClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/home", url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=callback", url.origin));
}
