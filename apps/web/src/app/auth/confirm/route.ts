import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const client = await createAuthClient();
  if (tokenHash && client && url.searchParams.get("type") === "email") {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL("/shop", url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirm", url.origin));
}
