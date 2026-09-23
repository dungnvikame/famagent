import type { Conversation, FamilyProfile } from "./types";

export const cloudEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const PENDING_IMPORT_KEY = "family-ai:pending-import:v1";
export function markPendingImport(onboardedAt: string) { localStorage.setItem(PENDING_IMPORT_KEY, onboardedAt); }
export function isPendingImport(onboardedAt?: string) { return Boolean(onboardedAt && localStorage.getItem(PENDING_IMPORT_KEY) === onboardedAt); }
export function clearPendingImport() { localStorage.removeItem(PENDING_IMPORT_KEY); }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) throw new Error(response.status === 401 ? "Cần đăng nhập để lưu dữ liệu." : "Không thể đồng bộ dữ liệu. Vui lòng thử lại.");
  return response.json() as Promise<T>;
}

export async function loadCloudProfile() { return (await api<{ profile: FamilyProfile | null }>("/api/me")).profile; }
export async function saveCloudProfile(profile: FamilyProfile) { await api("/api/me", { method: "PUT", body: JSON.stringify({ profile }) }); }
export async function clearCloudData() { await api("/api/me", { method: "DELETE" }); }
export async function loadCloudConversations() { return (await api<{ conversations: Conversation[] }>("/api/conversations")).conversations; }
export async function saveCloudConversation(conversation: Conversation) { await api("/api/conversations", { method: "PUT", body: JSON.stringify({ conversation }) }); }
export async function loadCloudSaved() { return (await api<{ ids: string[] }>("/api/saved")).ids; }
export async function setCloudSaved(productId: string, saved: boolean) { await api("/api/saved", { method: "PUT", body: JSON.stringify({ productId, saved }) }); }
