"use client";

// Browser side of family notes: /api/notes when Supabase is configured, else localStorage (demo mode).
import { cloudEnabled } from "@/lib/experience/cloud";
import { newNotes, type FamilyNote, type NoteCandidate } from "@/lib/ai/notes";

export const NOTES_KEY = "family-ai:notes:v1";
function readLocal(): FamilyNote[] { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]") as FamilyNote[]; } catch { return []; } }
const writeLocal = (notes: FamilyNote[]) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, 200)));

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Không thể đồng bộ ghi chú."); }
  return response.json() as Promise<T>;
}

export async function loadNotes(): Promise<FamilyNote[]> {
  if (cloudEnabled) return (await api<{ notes: FamilyNote[] }>("/api/notes")).notes;
  return readLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Demo mode only (signed-in users get notes recorded by /api/chat): stores new candidates, returns their texts. */
export function recordLocalNotes(candidates: NoteCandidate[], conversationId: string): string[] {
  const existing = readLocal();
  const fresh = newNotes(candidates, existing);
  if (fresh.length) writeLocal([...fresh.map((note): FamilyNote => ({ id: crypto.randomUUID(), text: note.text, kind: note.kind, status: "recorded", brand: note.brand, childId: note.childId, sourceConversationId: conversationId, createdAt: new Date().toISOString() })), ...existing]);
  return fresh.map((note) => note.text);
}

export async function confirmNote(id: string): Promise<void> {
  if (cloudEnabled) { await api("/api/notes", { method: "PATCH", body: JSON.stringify({ id, status: "confirmed" }) }); return; }
  writeLocal(readLocal().map((note) => note.id === id ? { ...note, status: "confirmed" } : note));
}

export async function deleteNote(id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  writeLocal(readLocal().filter((note) => note.id !== id));
}
