// Supabase side of Travel (migration 202610100028): trips, itinerary entries, packing items and expenses.
// Same contract as lib/shopping/item-store-server.ts: RLS scopes every row to the user; queries still filter by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseBucket, ItineraryEntry, PackingItem, Trip, TravelState, TripExpense, TripLink } from "./types.ts";
import { validExpense, validItineraryEntry, validPackingItem, validTrip } from "./validate.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" && value ? value : undefined;
const num = (value: unknown) => Number(value) || 0;

export const tripFromRow = (row: Row): Trip => ({
  id: row.id as string, name: row.name as string, destination: row.destination as string, destType: row.dest_type as Trip["destType"],
  startDate: row.start_date as string, endDate: row.end_date as string, status: row.status as Trip["status"],
  budgetAmount: num(row.budget_amount),
  budgetSplit: row.budget_split && Object.keys(row.budget_split as object).length ? row.budget_split as Partial<Record<ExpenseBucket, number>> : undefined,
  memberIds: Array.isArray(row.member_ids) && row.member_ids.length ? row.member_ids as string[] : undefined,
  links: Array.isArray(row.links) && row.links.length ? row.links as TripLink[] : undefined,
  goalId: str(row.goal_id), pushEnabled: row.push_enabled !== false, note: str(row.note),
});
const tripRow = (trip: Trip, userId: string) => ({
  id: trip.id, user_id: userId, name: trip.name, destination: trip.destination, dest_type: trip.destType,
  start_date: trip.startDate, end_date: trip.endDate, status: trip.status, budget_amount: trip.budgetAmount,
  budget_split: trip.budgetSplit ?? {}, member_ids: trip.memberIds ?? [], links: trip.links ?? [],
  goal_id: trip.goalId ?? null, push_enabled: trip.pushEnabled, note: trip.note ?? null, updated_at: new Date().toISOString(),
});

export const entryFromRow = (row: Row): ItineraryEntry => ({ id: row.id as string, tripId: row.trip_id as string, dayDate: str(row.day_date), position: num(row.position), timeLabel: str(row.time_label), title: row.title as string, note: str(row.note), url: str(row.url), estAmount: num(row.est_amount) });
const entryRow = (entry: ItineraryEntry, userId: string) => ({ id: entry.id, user_id: userId, trip_id: entry.tripId, day_date: entry.dayDate ?? null, position: entry.position, time_label: entry.timeLabel ?? null, title: entry.title, note: entry.note ?? null, url: entry.url ?? null, est_amount: entry.estAmount });

export const packingFromRow = (row: Row): PackingItem => ({ id: row.id as string, tripId: row.trip_id as string, name: row.name as string, qty: num(row.qty) || 1, category: row.category as PackingItem["category"], memberId: str(row.member_id), status: row.status as PackingItem["status"], source: row.source as PackingItem["source"] });
const packingRow = (item: PackingItem, userId: string) => ({ id: item.id, user_id: userId, trip_id: item.tripId, name: item.name, qty: item.qty, category: item.category, member_id: item.memberId ?? null, status: item.status, source: item.source });

export const expenseFromRow = (row: Row): TripExpense => ({ id: row.id as string, tripId: row.trip_id as string, occurredOn: row.occurred_on as string, content: row.content as string, bucket: row.bucket as TripExpense["bucket"], amount: num(row.amount), paidFrom: str(row.paid_from), transactionId: str(row.transaction_id) });
export const expenseRow = (expense: TripExpense, userId: string) => ({ id: expense.id, user_id: userId, trip_id: expense.tripId, occurred_on: expense.occurredOn, content: expense.content, bucket: expense.bucket, amount: expense.amount, paid_from: expense.paidFrom ?? null, transaction_id: expense.transactionId ?? null });

/** Upsertable resources of /api/travel/[resource]: validator, row mapper, conflict target, id column for DELETE. */
type Handler = { table: string; validate: (input: unknown) => object | null; row: (item: never, userId: string) => object; conflict: string; idColumn: string };
export const TRAVEL_RESOURCES = {
  trips: { table: "travel_trips", validate: validTrip, row: tripRow as Handler["row"], conflict: "id", idColumn: "id" },
  itinerary: { table: "travel_itinerary_entries", validate: validItineraryEntry, row: entryRow as Handler["row"], conflict: "id", idColumn: "id" },
  packing: { table: "travel_packing_items", validate: validPackingItem, row: packingRow as Handler["row"], conflict: "id", idColumn: "id" },
  expenses: { table: "travel_expenses", validate: validExpense, row: expenseRow as Handler["row"], conflict: "id", idColumn: "id" },
} satisfies Record<string, Handler>;
export type TravelResource = keyof typeof TRAVEL_RESOURCES;

/** Everything the Travel pages need in one request (a family has few trips; the per-trip tables stay small). */
export async function loadTravelState(client: SupabaseClient, userId: string): Promise<TravelState | null> {
  const [trips, itinerary, packing, expenses] = await Promise.all([
    client.from("travel_trips").select("*").eq("user_id", userId).order("start_date", { ascending: false }).limit(100),
    client.from("travel_itinerary_entries").select("*").eq("user_id", userId).order("day_date", { ascending: true, nullsFirst: false }).order("position").limit(1000),
    client.from("travel_packing_items").select("*").eq("user_id", userId).order("created_at").limit(1000),
    client.from("travel_expenses").select("*").eq("user_id", userId).order("occurred_on", { ascending: false }).limit(1000),
  ]);
  if (trips.error || itinerary.error || packing.error || expenses.error) return null;
  return {
    trips: (trips.data ?? []).map(tripFromRow),
    itinerary: (itinerary.data ?? []).map(entryFromRow),
    packing: (packing.data ?? []).map(packingFromRow),
    expenses: (expenses.data ?? []).map(expenseFromRow),
  };
}

/** Deleting a trip cascades to its entries/packing/expenses; mirrored ledger rows are removed explicitly (Đợt 3 keeps them linked). */
export async function deleteTrip(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data: mirrored } = await client.from("travel_expenses").select("transaction_id").eq("user_id", userId).eq("trip_id", id).not("transaction_id", "is", null);
  const { error } = await client.from("travel_trips").delete().eq("id", id).eq("user_id", userId);
  if (error) return false;
  const transactionIds = (mirrored ?? []).map((row) => row.transaction_id as string);
  if (transactionIds.length) await client.from("money_transactions").delete().eq("user_id", userId).eq("source", "trip").in("id", transactionIds);
  return true;
}
