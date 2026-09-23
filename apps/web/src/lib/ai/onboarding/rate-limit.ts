// Budget for onboarding LLM calls. With Supabase every visitor has a (possibly anonymous)
// user and turns are counted in api_request_limits; without it, an in-memory per-IP window
// is enough for local demos (not durable across serverless instances — plan P3 risk).

export const ONBOARDING_LLM_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

/** Records a hit and returns true while the key is under the hourly budget. */
export function allowInMemory(key: string, now = Date.now(), limit = ONBOARDING_LLM_PER_HOUR): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [entry, times] of hits) if (!times.some((time) => now - time < WINDOW_MS)) hits.delete(entry);
  return true;
}
