"use client";

// Browser side of the Family page extras: /api/family/* when Supabase is configured, else localStorage (demo mode).
import { cloudEnabled } from "@/lib/experience/cloud";
import type { WeightPoint } from "./child-stats";
import { validAvatarImage, validWeightInput } from "./validate";

export type ChildWeight = WeightPoint & { id: string; childId: string };
const WEIGHTS_KEY = "family-ai:weights:v1";
const AVATARS_KEY = "family-ai:avatars:v1";

function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function write(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { throw new Error("Bộ nhớ trình duyệt đã đầy — chưa lưu được."); } }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Không thể đồng bộ dữ liệu."); }
  return response.json() as Promise<T>;
}

export async function loadWeights(): Promise<ChildWeight[]> {
  if (cloudEnabled) return (await api<{ weights: ChildWeight[] }>("/api/family/weights")).weights;
  return read<ChildWeight[]>(WEIGHTS_KEY, []);
}

/** Saves one weighing (same child + day replaces) and returns its id. */
export async function saveWeight(childId: string, date: string, kg: number): Promise<string> {
  if (!validWeightInput({ childId, date, kg })) throw new Error("Cân nặng từ 1 đến 40 kg, ngày không ở tương lai.");
  if (cloudEnabled) return (await api<{ id: string }>("/api/family/weights", { method: "POST", body: JSON.stringify({ childId, date, kg }) })).id;
  const rest = read<ChildWeight[]>(WEIGHTS_KEY, []).filter((row) => !(row.childId === childId && row.date === date));
  const id = crypto.randomUUID();
  write(WEIGHTS_KEY, [...rest, { id, childId, date, kg }]);
  return id;
}

export async function deleteWeight(id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/family/weights?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  write(WEIGHTS_KEY, read<ChildWeight[]>(WEIGHTS_KEY, []).filter((row) => row.id !== id));
}

export async function loadAvatars(): Promise<Record<string, string>> {
  if (cloudEnabled) return (await api<{ avatars: Record<string, string> }>("/api/family/avatars")).avatars;
  return read<Record<string, string>>(AVATARS_KEY, {});
}

export async function saveAvatar(memberId: string, image: string): Promise<void> {
  if (!validAvatarImage(image)) throw new Error("Ảnh quá lớn, thử ảnh khác.");
  if (cloudEnabled) { await api("/api/family/avatars", { method: "PUT", body: JSON.stringify({ memberId, image }) }); return; }
  write(AVATARS_KEY, { ...read<Record<string, string>>(AVATARS_KEY, {}), [memberId]: image });
}

export async function removeAvatar(memberId: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/family/avatars?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" }); return; }
  const next = read<Record<string, string>>(AVATARS_KEY, {});
  delete next[memberId];
  write(AVATARS_KEY, next);
}

export function clearLocalFamily() { localStorage.removeItem(WEIGHTS_KEY); localStorage.removeItem(AVATARS_KEY); }
