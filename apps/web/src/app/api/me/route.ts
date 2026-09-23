import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import { validProfile } from "@/lib/experience/validate";
import type { FamilyProfile } from "@/lib/experience/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const { data, error } = await auth.client.from("family_profiles").select("*,children(*)").eq("user_id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Không thể tải hồ sơ" }, { status: 500 });
  if (!data) return NextResponse.json({ profile: null });
  const profile: FamilyProfile = {
    id: data.id, familyName: data.name ?? undefined, pricePreference: data.price_preference,
    mainConcern: data.main_concern ?? undefined, maxBudget: data.max_budget ?? undefined,
    aiConsent: data.ai_consent, onboardedAt: data.onboarded_at ?? undefined, updatedAt: data.updated_at,
    children: (data.children ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position).map((child: Record<string, unknown>) => ({ id: child.id as string, name: child.name as string | undefined, weightKg: child.current_weight_kg ? Number(child.current_weight_kg) : undefined, ageMonths: child.age_months as number | undefined, diaperSize: child.diaper_size as string | undefined })),
  };
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { profile?: unknown } | null;
  if (!validProfile(body?.profile)) return NextResponse.json({ error: "Hồ sơ không hợp lệ" }, { status: 400 });
  const profile = body.profile;
  const now = new Date().toISOString();
  const { data: family, error } = await auth.client.from("family_profiles").upsert({
    user_id: auth.user.id, name: profile.familyName || null, price_preference: profile.pricePreference,
    main_concern: profile.mainConcern || null, max_budget: profile.maxBudget || null,
    ai_consent: profile.aiConsent, onboarded_at: profile.onboardedAt || null, updated_at: now,
  }, { onConflict: "user_id" }).select("id").single();
  if (error || !family) return NextResponse.json({ error: "Không thể lưu hồ sơ" }, { status: 500 });
  const { data: existing, error: readError } = await auth.client.from("children").select("id").eq("family_profile_id", family.id);
  if (readError) return NextResponse.json({ error: "Không thể tải thông tin bé" }, { status: 500 });
  const existingIds = new Set((existing ?? []).map((child) => child.id));
  const childIds = profile.children.map((child) => /^[a-f0-9-]{36}$/i.test(child.id) ? child.id : crypto.randomUUID());
  if (profile.children.length) {
    const { error: childError } = await auth.client.from("children").upsert(profile.children.map((child, index) => ({
      id: childIds[index], family_profile_id: family.id, name: child.name || null,
      current_weight_kg: child.weightKg ?? null, age_months: child.ageMonths ?? null, position: index,
      diaper_size: child.diaperSize || null, updated_at: now,
    })));
    if (childError) return NextResponse.json({ error: "Không thể lưu thông tin bé" }, { status: 500 });
  }
  const removed = [...existingIds].filter((id) => !childIds.includes(id));
  if (removed.length) {
    const { error: removeError } = await auth.client.from("children").delete().eq("family_profile_id", family.id).in("id", removed);
    if (removeError) return NextResponse.json({ error: "Không thể cập nhật danh sách bé" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const client = auth.client;
  const userId = auth.user.id;
  const { error: savedError } = await client.from("saved_products").delete().eq("user_id", userId);
  const { error: logsError } = await client.from("recommendation_sessions").delete().eq("user_id", userId);
  const { error: analyticsError } = await client.from("analytics_events").delete().eq("user_id", userId);
  const { error: clicksError } = await client.from("affiliate_clicks").delete().eq("user_id", userId);
  const { error: limitsError } = await client.from("api_request_limits").delete().eq("user_id", userId);
  const { error: conversationsError } = await client.from("conversations").delete().eq("user_id", userId);
  const { error: familyError } = await client.from("family_profiles").delete().eq("user_id", userId);
  if (savedError || logsError || analyticsError || clicksError || limitsError || conversationsError || familyError) return NextResponse.json({ error: "Chưa thể xóa toàn bộ dữ liệu" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
