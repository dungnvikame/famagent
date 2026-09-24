import type { Conversation, FamilyProfile } from "./types";

const PROFILE_KEY = "family-ai:profile:v1";
const CONVERSATIONS_KEY = "family-ai:conversations:v1";
const SAVED_KEY = "family-ai:saved:v1";
const EVENTS_KEY = "family-ai:events:v1";
// Legacy key from the pre-anonymous-session import flow; still cleared by clearAllData().
const PENDING_IMPORT_KEY = "family-ai:pending-import:v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

export function getProfile(): FamilyProfile | null { return read<FamilyProfile | null>(PROFILE_KEY, null); }
export function saveProfile(profile: FamilyProfile): void { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
export function clearProfile(): void { localStorage.removeItem(PROFILE_KEY); }
export function clearAllData(): void { for (const key of [PROFILE_KEY, CONVERSATIONS_KEY, SAVED_KEY, EVENTS_KEY, PENDING_IMPORT_KEY, "family-ai:money:v1", "family-ai:purchases:v1", "family-ai:notes:v1", "family-ai:routine:v1"]) localStorage.removeItem(key); document.cookie = "family-ai-onboarded=; Path=/; SameSite=Lax; Max-Age=0"; }
export function getConversations(): Conversation[] { return read<Conversation[]>(CONVERSATIONS_KEY, []); }
export function saveConversations(items: Conversation[]): void { localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(items.slice(0, 30))); }
export function getSavedProducts(): string[] { return read<string[]>(SAVED_KEY, []); }
export function saveSavedProducts(ids: string[]): void { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); }
export function trackEvent(name: string, data: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  const events = read<Array<{ name: string; at: string; data: typeof data }>>(EVENTS_KEY, []);
  localStorage.setItem(EVENTS_KEY, JSON.stringify([...events.slice(-199), { name, at: new Date().toISOString(), data }]));
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, data }), keepalive: true }).catch(() => {});
  }
}
