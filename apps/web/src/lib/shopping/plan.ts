// Monthly shopping plan (phase 2): proposals come from forecast run-out dates, the family's own entries override them.
// Pure functions; entries persist in shopping_plan_entries (or the browser in demo mode).
import { addDays, daysBetween, type ItemEstimate } from "./items.ts";

export const PLAN_REASONS = ["running_low", "stage", "manual", "sale"] as const;
export type PlanReason = (typeof PLAN_REASONS)[number];
export const PLAN_STATUSES = ["planned", "bought", "skipped"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface PlanEntry { id: string; month: string; itemId?: string; stageKey?: string; name: string; packs: number; estAmount?: number; reason: PlanReason; status: PlanStatus }

export interface PlanLine {
  /** Stable key: item id, stage key or entry id. */
  key: string;
  itemId?: string;
  stageKey?: string;
  name: string;
  packs: number;
  estAmount?: number;
  reason: PlanReason;
  status: PlanStatus;
  /** Set when the family saved something about this line. */
  entryId?: string;
  /** Forecast run-out day, for proposals. */
  dueOn?: string;
}

/** Days of cover a plan buys past the end of the month, so the first days of next month are not a scramble. */
export const PLAN_BUFFER_DAYS = 7;
const monthEnd = (month: string) => { const [y, m] = month.split("-").map(Number); return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
export const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); const date = new Date(y, m - 1 + delta, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

/** Items that run out before the end of `month` (+ buffer): packs needed to cover until then, at the last pack price. */
export function proposePlan(estimates: ItemEstimate[], month: string, today: string): PlanLine[] {
  const end = addDays(monthEnd(month), PLAN_BUFFER_DAYS);
  const from = today > `${month}-01` ? today : `${month}-01`;
  const out: PlanLine[] = [];
  for (const estimate of estimates) {
    if (!estimate.known || !estimate.runsOutOn || estimate.runsOutOn > end) continue;
    const start = estimate.runsOutOn > from ? estimate.runsOutOn : from;
    const need = estimate.dailyRate * Math.max(1, daysBetween(start, end));
    const pack = estimate.item.packSize ?? Math.max(1, Math.round(estimate.dailyRate * 30));
    const packs = Math.min(50, Math.max(1, Math.ceil(need / pack)));
    out.push({ key: estimate.item.id, itemId: estimate.item.id, name: estimate.item.name, packs, estAmount: estimate.lastPackPrice ? estimate.lastPackPrice * packs : undefined, reason: "running_low", status: "planned", dueOn: estimate.runsOutOn });
  }
  return out.sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));
}

/** Proposals merged with the family's entries for the month: an entry for the same item/stage replaces the proposal. */
export function mergePlan(proposals: PlanLine[], entries: PlanEntry[], month: string): PlanLine[] {
  const own = entries.filter((entry) => entry.month === month);
  const keyOf = (entry: PlanEntry) => entry.itemId ?? entry.stageKey ?? entry.id;
  const byKey = new Map(own.map((entry) => [keyOf(entry), entry]));
  const lines: PlanLine[] = proposals.map((line) => {
    const entry = byKey.get(line.key);
    return entry ? { ...line, packs: entry.packs, estAmount: entry.estAmount ?? line.estAmount, status: entry.status, entryId: entry.id } : line;
  });
  const seen = new Set(proposals.map((line) => line.key));
  for (const entry of own) if (!seen.has(keyOf(entry))) lines.push({ key: keyOf(entry), itemId: entry.itemId, stageKey: entry.stageKey, name: entry.name, packs: entry.packs, estAmount: entry.estAmount, reason: entry.reason, status: entry.status, entryId: entry.id });
  const order: Record<PlanStatus, number> = { planned: 0, bought: 1, skipped: 2 };
  return lines.sort((a, b) => order[a.status] - order[b.status]);
}

/** Estimated cost of what is still planned (bought and skipped lines excluded). */
export const planTotal = (lines: PlanLine[]) => lines.filter((line) => line.status === "planned").reduce((sum, line) => sum + (line.estAmount ?? 0), 0);

/** The entry that records a change to a line (keeps the proposal's key so it keeps overriding it). */
export const entryFor = (line: PlanLine, month: string, patch: Partial<PlanEntry>, id = line.entryId ?? crypto.randomUUID()): PlanEntry =>
  ({ id, month, itemId: line.itemId, stageKey: line.stageKey, name: line.name, packs: line.packs, estAmount: line.estAmount, reason: line.reason, status: line.status, ...patch });
