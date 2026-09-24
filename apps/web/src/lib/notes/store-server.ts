import type { SupabaseClient } from "@supabase/supabase-js";
import { newNotes, type FamilyNote, type NoteCandidate } from "../ai/notes.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : undefined;
export const noteFromRow = (row: Row): FamilyNote => ({ id: row.id as string, text: row.text as string, kind: row.kind as FamilyNote["kind"], status: row.status as FamilyNote["status"], brand: str(row.brand), childId: str(row.child_id), sourceConversationId: str(row.source_conversation_id), createdAt: row.created_at as string });

export async function loadNotes(client: SupabaseClient, userId: string): Promise<FamilyNote[] | null> {
  const { data, error } = await client.from("family_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  return error ? null : (data ?? []).map(noteFromRow);
}

/** Saves candidates that are not already known; returns the texts actually recorded. */
export async function recordNotes(client: SupabaseClient, userId: string, candidates: NoteCandidate[], conversationId: string | null, existing: FamilyNote[]): Promise<string[]> {
  const fresh = newNotes(candidates, existing);
  if (!fresh.length) return [];
  const { error } = await client.from("family_notes").insert(fresh.map((note) => ({ user_id: userId, text: note.text, kind: note.kind, brand: note.brand ?? null, child_id: note.childId && /^[a-f0-9-]{36}$/i.test(note.childId) ? note.childId : null, source_conversation_id: conversationId })));
  if (error) { console.warn("[family_notes]", JSON.stringify({ code: error.code ?? "unknown" })); return []; }
  return fresh.map((note) => note.text);
}
