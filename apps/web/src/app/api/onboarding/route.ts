import { NextResponse } from "next/server";
import { processOnboarding } from "@/lib/ai/onboarding";
import type { FamilyProfile } from "@/lib/experience/types";
import { authConfigured } from "@/lib/supabase/server";
import { validProfile } from "@/lib/experience/validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { step?: "child" | "preferences"; message?: string; profile?: FamilyProfile } | null;
  if (!body || !["child", "preferences"].includes(body.step ?? "") || typeof body.message !== "string" || body.message.length > 600 || !validProfile(body.profile)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  // Onboarding is available before sign-in. In account mode, reserve paid AI calls for authenticated chat.
  const profile = authConfigured() ? { ...body.profile, aiConsent: false } : body.profile;
  const result = await processOnboarding(body.step!, body.message, profile);
  return NextResponse.json(authConfigured() ? { ...result, profile: { ...result.profile, aiConsent: body.profile.aiConsent } } : result);
}
