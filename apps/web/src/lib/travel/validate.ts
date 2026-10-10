// Validators for /api/travel/[resource] bodies — same contract as lib/shopping/item-validate.ts: unknown in,
// a typed object or null out. Relative .ts imports so tests can run them under node --test.
import { DEST_TYPES, EXPENSE_BUCKETS, PACKING_CATEGORIES, PACKING_SOURCES, PACKING_STATUSES, TRIP_STATUSES, type DestType, type ExpenseBucket, type ItineraryEntry, type PackingCategory, type PackingItem, type PackingSource, type PackingStatus, type Trip, type TripExpense, type TripLink, type TripStatus } from "./types.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const opt = (value: unknown, max: number) => value === undefined || value === null || value === "" ? undefined : text(value, max) ?? undefined;
const money = (value: unknown, fallback?: number) => { const amount = value === undefined || value === null || value === "" ? fallback : Number(value); return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000_000 ? Math.round(amount) : undefined; };
const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null => list.includes(value as T) ? value as T : null;
const memberId = (value: unknown) => typeof value === "string" && /^[a-z0-9-]{1,40}$/.test(value) ? value : undefined;

/** PUT /api/travel/trips → a Trip or null. */
export function validTrip(input: unknown): Trip | null {
  if (!isRecord(input) || !isUuid(input.id)) return null;
  const name = text(input.name, 80); const destination = text(input.destination, 120);
  const destType = oneOf<DestType>(DEST_TYPES, input.destType ?? "other");
  const status = oneOf<TripStatus>(TRIP_STATUSES, input.status ?? "planning");
  const budgetAmount = money(input.budgetAmount, 0);
  if (!name || !destination || !destType || !status || budgetAmount === undefined) return null;
  if (!isDay(input.startDate) || !isDay(input.endDate) || input.endDate < input.startDate) return null;
  let budgetSplit: Trip["budgetSplit"];
  if (input.budgetSplit !== undefined && input.budgetSplit !== null) {
    if (!isRecord(input.budgetSplit)) return null;
    budgetSplit = {};
    for (const bucket of EXPENSE_BUCKETS) {
      const pct = input.budgetSplit[bucket];
      if (pct === undefined) continue;
      if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) return null;
      budgetSplit[bucket] = Math.round(pct);
    }
  }
  const memberIds = Array.isArray(input.memberIds) ? input.memberIds.map(memberId).filter((id): id is string => Boolean(id)).slice(0, 15) : undefined;
  let links: TripLink[] | undefined;
  if (Array.isArray(input.links)) {
    links = [];
    for (const raw of input.links.slice(0, 10)) {
      if (!isRecord(raw)) return null;
      const label = text(raw.label, 60); const url = text(raw.url, 500);
      if (!label || !url || !/^https?:\/\//i.test(url)) return null;
      links.push({ label, url });
    }
  }
  return { id: input.id, name, destination, destType, startDate: input.startDate, endDate: input.endDate, status, budgetAmount, budgetSplit, memberIds, links, goalId: isUuid(input.goalId) ? input.goalId : undefined, pushEnabled: input.pushEnabled !== false, note: opt(input.note, 1000) };
}

/** PUT /api/travel/itinerary → one itinerary entry. */
export function validItineraryEntry(input: unknown): ItineraryEntry | null {
  if (!isRecord(input) || !isUuid(input.id) || !isUuid(input.tripId)) return null;
  const title = text(input.title, 120);
  const position = input.position === undefined ? 0 : Number(input.position);
  const estAmount = money(input.estAmount, 0);
  if (!title || !Number.isInteger(position) || position < 0 || position > 200 || estAmount === undefined) return null;
  if (input.dayDate !== undefined && input.dayDate !== null && input.dayDate !== "" && !isDay(input.dayDate)) return null;
  const url = opt(input.url, 500);
  if (url && !/^https?:\/\//i.test(url)) return null;
  return { id: input.id, tripId: input.tripId, dayDate: isDay(input.dayDate) ? input.dayDate : undefined, position, timeLabel: opt(input.timeLabel, 20), title, note: opt(input.note, 500), url, estAmount };
}

/** PUT /api/travel/packing → one packing item. */
export function validPackingItem(input: unknown): PackingItem | null {
  if (!isRecord(input) || !isUuid(input.id) || !isUuid(input.tripId)) return null;
  const name = text(input.name, 80);
  const qty = input.qty === undefined ? 1 : Number(input.qty);
  const category = oneOf<PackingCategory>(PACKING_CATEGORIES, input.category ?? "other");
  const status = oneOf<PackingStatus>(PACKING_STATUSES, input.status ?? "todo");
  const source = oneOf<PackingSource>(PACKING_SOURCES, input.source ?? "manual");
  if (!name || !category || !status || !source || !Number.isInteger(qty) || qty < 1 || qty > 99) return null;
  return { id: input.id, tripId: input.tripId, name, qty, category, memberId: memberId(input.memberId), status, source };
}

/** PUT /api/travel/expenses → one trip expense (the ledger mirror happens server-side, Đợt 3). */
export function validExpense(input: unknown): TripExpense | null {
  if (!isRecord(input) || !isUuid(input.id) || !isUuid(input.tripId) || !isDay(input.occurredOn)) return null;
  const content = text(input.content, 120);
  const bucket = oneOf<ExpenseBucket>(EXPENSE_BUCKETS, input.bucket ?? "misc");
  const amount = money(input.amount);
  if (!content || !bucket || amount === undefined) return null;
  return { id: input.id, tripId: input.tripId, occurredOn: input.occurredOn, content, bucket, amount, paidFrom: opt(input.paidFrom, 40), transactionId: isUuid(input.transactionId) ? input.transactionId : undefined };
}
