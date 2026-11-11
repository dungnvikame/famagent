import type { FamilyProfile } from "./types";

export const cloudEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) throw new Error(response.status === 401 ? "Cần đăng nhập để lưu dữ liệu." : "Không thể đồng bộ dữ liệu. Vui lòng thử lại.");
  return response.json() as Promise<T>;
}

export async function loadCloudProfile() { return (await api<{ profile: FamilyProfile | null }>("/api/me")).profile; }
export async function saveCloudProfile(profile: FamilyProfile) { await api("/api/me", { method: "PUT", body: JSON.stringify({ profile }) }); }
export async function clearCloudData() { await api("/api/me", { method: "DELETE" }); }
