import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";

const names = new Set(["homepage_view", "family_profile_created", "family_profile_updated", "ai_message_sent", "intent_created", "recommendation_generated", "recommendation_viewed", "product_clicked", "compare_started", "offer_clicked"]);

export async function POST(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: string; data?: Record<string, unknown> } | null;
  if (!body?.name || !names.has(body.name) || !body.data || typeof body.data !== "object" || Array.isArray(body.data) || JSON.stringify(body.data).length > 1000) return NextResponse.json({ error: "Sự kiện không hợp lệ" }, { status: 400 });
  const { error } = await auth.client.from("analytics_events").insert({ user_id: auth.user.id, event_name: body.name, properties: body.data });
  return error ? NextResponse.json({ error: "Không thể ghi sự kiện" }, { status: 500 }) : NextResponse.json({ ok: true });
}
