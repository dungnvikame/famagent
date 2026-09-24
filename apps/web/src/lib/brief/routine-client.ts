"use client";

// Ticks for "Việc hôm nay": Supabase (/api/routine) when signed in, so every device of the family sees them;
// localStorage in demo mode. Only completions are stored — the task list is recomputed from profile + date.
import { cloudEnabled } from "@/lib/experience/cloud";
import { localDay } from "./daily-tasks";

const KEY = "family-ai:routine:v1";
const WINDOW_DAYS = 60;
export type DoneByDay = Record<string, string[]>;

function readLocal(): DoneByDay { try { return JSON.parse(localStorage.getItem(KEY) || "{}") as DoneByDay; } catch { return {}; } }
function writeLocal(value: DoneByDay) { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(value).sort().slice(-WINDOW_DAYS)))); } catch { /* storage blocked */ } }

/** Completions for the streak window (last 60 days). */
export async function loadDone(now = new Date()): Promise<DoneByDay> {
  if (!cloudEnabled) return readLocal();
  const from = localDay(new Date(now.getTime() - WINDOW_DAYS * 86_400_000));
  const response = await fetch(`/api/routine?from=${from}`, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Cần đăng nhập để lưu việc đã làm." : "Không thể tải việc đã làm.");
  return ((await response.json()) as { done: DoneByDay }).done;
}

/** Tick or untick one task; throws on a failed save so the caller can roll back. */
export async function setDone(day: string, taskId: string, done: boolean): Promise<void> {
  if (!cloudEnabled) {
    const value = readLocal();
    const list = new Set(value[day] ?? []);
    if (done) list.add(taskId); else list.delete(taskId);
    writeLocal({ ...value, [day]: [...list] });
    return;
  }
  const response = await fetch("/api/routine", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, taskId, done }) });
  if (!response.ok) throw new Error("Chưa lưu được. Vui lòng thử lại.");
}
