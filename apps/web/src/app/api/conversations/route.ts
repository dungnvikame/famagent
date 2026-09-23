import { NextResponse } from "next/server";
import { authenticated } from "@/lib/supabase/server";
import type { ChatTurn, Conversation } from "@/lib/experience/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const { data, error } = await auth.client.from("conversations").select("id,title,updated_at,messages(id,role,content,created_at,metadata)").eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Không thể tải lịch sử" }, { status: 500 });
  const conversations: Conversation[] = (data ?? []).map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at,
    turns: (row.messages ?? []).map((message: { id: string; role: "user" | "assistant"; content: string; created_at: string; metadata: Record<string, unknown> }) => ({ id: message.id, role: message.role, text: message.content, createdAt: message.created_at, ...message.metadata } as ChatTurn)).sort((a: ChatTurn, b: ChatTurn) => a.createdAt.localeCompare(b.createdAt)),
  }));
  return NextResponse.json({ conversations }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const body = await request.json().catch(() => null) as { conversation?: Conversation } | null;
  const item = body?.conversation;
  if (!item || !/^[a-f0-9-]{36}$/i.test(item.id) || typeof item.title !== "string" || item.title.length > 120 || !Array.isArray(item.turns) || item.turns.length > 200) return NextResponse.json({ error: "Hội thoại không hợp lệ" }, { status: 400 });
  if (!item.turns.every((turn) => /^[a-f0-9-]{36}$/i.test(turn.id) && ["user", "assistant"].includes(turn.role) && typeof turn.text === "string" && turn.text.length <= 4000)) return NextResponse.json({ error: "Tin nhắn không hợp lệ" }, { status: 400 });
  const { error: conversationError } = await auth.client.from("conversations").upsert({ id: item.id, user_id: auth.user.id, title: item.title, updated_at: new Date().toISOString() });
  if (conversationError) return NextResponse.json({ error: "Không thể lưu hội thoại" }, { status: 500 });
  if (item.turns.length) {
    const { error } = await auth.client.from("messages").upsert(item.turns.map((turn) => ({ id: turn.id, conversation_id: item.id, role: turn.role, content: turn.text,
      created_at: turn.createdAt, metadata: turn.role === "assistant" ? { recommendations: turn.recommendations, intent: turn.intent, candidateCount: turn.candidateCount, candidateProductIds: turn.candidateProductIds, rankingVersion: turn.rankingVersion, view: turn.view } : {},
    })));
    if (error) return NextResponse.json({ error: "Không thể lưu tin nhắn" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
