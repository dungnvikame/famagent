"use client";

// Browser side of the Family page extras: /api/family/* when Supabase is configured, else localStorage (demo mode).
import { cloudEnabled } from "@/lib/experience/cloud";
import { validAvatarImage, validMeasureInput, validMilestoneInput } from "./validate";
import type { MilestoneRecord, MilestoneStatus } from "./milestones";

/** One day's growth measurement of a child: weight, height or both. */
export interface ChildMeasure { id: string; childId: string; date: string; kg?: number; cm?: number }
const WEIGHTS_KEY = "family-ai:weights:v1";
const AVATARS_KEY = "family-ai:avatars:v1";
const MILESTONES_KEY = "family-ai:milestones:v1";

function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function write(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { throw new Error("Bộ nhớ trình duyệt đã đầy — chưa lưu được."); } }

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Không thể đồng bộ dữ liệu."); }
  return response.json() as Promise<T>;
}

export async function loadMeasures(): Promise<ChildMeasure[]> {
  if (cloudEnabled) return (await api<{ weights: ChildMeasure[] }>("/api/family/weights")).weights;
  return read<ChildMeasure[]>(WEIGHTS_KEY, []);
}

/** Saves a day's weight and/or height (only the values given change) and returns the day's id. */
export async function saveMeasure(childId: string, date: string, values: { kg?: number; cm?: number }): Promise<string> {
  if (!validMeasureInput({ childId, date, ...values })) throw new Error("Cân nặng 1–40 kg, chiều cao 35–200 cm, ngày không ở tương lai.");
  if (cloudEnabled) return (await api<{ id: string }>("/api/family/weights", { method: "POST", body: JSON.stringify({ childId, date, ...values }) })).id;
  const rows = read<ChildMeasure[]>(WEIGHTS_KEY, []);
  const same = rows.find((row) => row.childId === childId && row.date === date);
  const id = same?.id ?? crypto.randomUUID();
  write(WEIGHTS_KEY, [...rows.filter((row) => row !== same), { ...same, id, childId, date, ...values }]);
  return id;
}

/** Clears the weight or the height of a day; the day goes when nothing is left. */
export async function deleteMeasure(id: string, field: "kg" | "cm"): Promise<void> {
  if (cloudEnabled) { await api(`/api/family/weights?id=${encodeURIComponent(id)}&field=${field}`, { method: "DELETE" }); return; }
  const rows = read<ChildMeasure[]>(WEIGHTS_KEY, []).flatMap((row) => { if (row.id !== id) return [row]; const next = { ...row, [field]: undefined }; return next.kg === undefined && next.cm === undefined ? [] : [next]; });
  write(WEIGHTS_KEY, rows);
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

export async function loadMilestones(): Promise<MilestoneRecord[]> {
  if (cloudEnabled) return (await api<{ milestones: MilestoneRecord[] }>("/api/family/milestones")).milestones;
  return read<MilestoneRecord[]>(MILESTONES_KEY, []);
}

/** Marks a milestone "done" (with the day) or "not_yet"; `null` clears the mark. */
export async function saveMilestone(childId: string, milestoneId: string, status: MilestoneStatus | null, on?: string): Promise<void> {
  if (status && !validMilestoneInput({ childId, milestoneId, status, on })) throw new Error("Ngày không hợp lệ.");
  if (cloudEnabled) {
    if (status) await api("/api/family/milestones", { method: "PUT", body: JSON.stringify({ childId, milestoneId, status, on }) });
    else await api(`/api/family/milestones?childId=${encodeURIComponent(childId)}&milestoneId=${encodeURIComponent(milestoneId)}`, { method: "DELETE" });
    return;
  }
  const rest = read<MilestoneRecord[]>(MILESTONES_KEY, []).filter((row) => !(row.childId === childId && row.milestoneId === milestoneId));
  write(MILESTONES_KEY, status ? [...rest, { childId, milestoneId, status, ...(status === "done" && on ? { on } : {}) }] : rest);
}

/** Last weighing and last height day per child (for the measuring schedule). */
export function lastMeasureDays(rows: ChildMeasure[]): Record<string, { weight?: string; height?: string }> {
  const out: Record<string, { weight?: string; height?: string }> = {};
  for (const row of rows) {
    const entry = out[row.childId] ??= {};
    if (row.kg !== undefined && row.kg !== null && (!entry.weight || row.date > entry.weight)) entry.weight = row.date;
    if (row.cm !== undefined && row.cm !== null && (!entry.height || row.date > entry.height)) entry.height = row.date;
  }
  return out;
}

export function clearLocalFamily() { localStorage.removeItem(WEIGHTS_KEY); localStorage.removeItem(AVATARS_KEY); localStorage.removeItem(MILESTONES_KEY); }
