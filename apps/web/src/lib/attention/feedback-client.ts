"use client";

// Browser side of insight feedback: /api/feedback when Supabase is configured, else localStorage (demo mode).
import { cloudEnabled } from "@/lib/experience/cloud";
import { trackEvent } from "@/lib/experience/storage";
import { feedbackFor, type FeedbackVerdict, type InsightFeedback } from "./engine";

const KEY = "family-ai:insight-feedback:v1";
const readLocal = (): InsightFeedback[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as InsightFeedback[]; } catch { return []; } };

export async function loadFeedback(): Promise<InsightFeedback[]> {
  if (!cloudEnabled) return readLocal();
  const response = await fetch("/api/feedback", { cache: "no-store" });
  if (!response.ok) return [];
  return ((await response.json()) as { feedback: InsightFeedback[] }).feedback;
}

export async function sendFeedback(key: string, verdict: FeedbackVerdict): Promise<InsightFeedback> {
  trackEvent("insight_feedback", { kind: key.split(":")[0], verdict });
  if (!cloudEnabled) { const entry = feedbackFor(key, verdict); localStorage.setItem(KEY, JSON.stringify([...readLocal().filter((item) => item.key !== key), entry])); return entry; }
  const response = await fetch("/api/feedback", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, verdict }) });
  if (!response.ok) throw new Error("Chưa lưu được phản hồi.");
  return ((await response.json()) as { feedback: InsightFeedback }).feedback;
}
