"use client";

// Browser side of Travel: /api/travel when Supabase is configured, else localStorage (demo mode) —
// same split as lib/shopping/item-client.ts.
import { cloudEnabled } from "@/lib/experience/cloud";
import type { ItineraryEntry, PackingItem, TravelState, Trip, TripExpense } from "./types";

const KEYS = { trips: "family-ai:travel-trips:v1", itinerary: "family-ai:travel-itinerary:v1", packing: "family-ai:travel-packing:v1", expenses: "family-ai:travel-expenses:v1" } as const;

function readLocal<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; } }
const writeLocal = <T,>(key: string, items: T[]) => localStorage.setItem(key, JSON.stringify(items));

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || (response.status === 401 ? "Cần đăng nhập để lưu chuyến đi." : "Không thể đồng bộ dữ liệu.")); }
  return response.json() as Promise<T>;
}

export async function loadTravel(): Promise<TravelState> {
  if (cloudEnabled) return api<TravelState>("/api/travel");
  return { trips: readLocal<Trip>(KEYS.trips), itinerary: readLocal<ItineraryEntry>(KEYS.itinerary), packing: readLocal<PackingItem>(KEYS.packing), expenses: readLocal<TripExpense>(KEYS.expenses) };
}

type Resource = keyof typeof KEYS;
async function save<T extends { id: string }>(resource: Resource, item: T): Promise<void> {
  if (cloudEnabled) { await api(`/api/travel/${resource}`, { method: "PUT", body: JSON.stringify({ item }) }); return; }
  writeLocal(KEYS[resource], [...readLocal<T>(KEYS[resource]).filter((entry) => entry.id !== item.id), item]);
}
async function remove(resource: Resource, id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/travel/${resource}?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  writeLocal(KEYS[resource], readLocal<{ id: string }>(KEYS[resource]).filter((entry) => entry.id !== id));
}

export const saveTrip = (trip: Trip) => save("trips", trip);
export const saveEntry = (entry: ItineraryEntry) => save("itinerary", entry);
export const savePacking = (item: PackingItem) => save("packing", item);
/** Returns the stored expense: the server adds the mirrored ledger row's transactionId. */
export async function saveExpense(expense: TripExpense): Promise<TripExpense> {
  if (cloudEnabled) return (await api<{ item: TripExpense }>("/api/travel/expenses", { method: "PUT", body: JSON.stringify({ item: expense }) })).item;
  writeLocal(KEYS.expenses, [...readLocal<TripExpense>(KEYS.expenses).filter((entry) => entry.id !== expense.id), expense]);
  return expense;
}
export const deleteEntry = (id: string) => remove("itinerary", id);
export const deletePacking = (id: string) => remove("packing", id);
export const deleteExpense = (id: string) => remove("expenses", id);

/** Deleting a trip also clears its children (the server cascades; demo mode filters by tripId). */
export async function deleteTrip(id: string): Promise<void> {
  if (cloudEnabled) { await api(`/api/travel/trips?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return; }
  writeLocal(KEYS.trips, readLocal<Trip>(KEYS.trips).filter((trip) => trip.id !== id));
  writeLocal(KEYS.itinerary, readLocal<ItineraryEntry>(KEYS.itinerary).filter((entry) => entry.tripId !== id));
  writeLocal(KEYS.packing, readLocal<PackingItem>(KEYS.packing).filter((item) => item.tripId !== id));
  writeLocal(KEYS.expenses, readLocal<TripExpense>(KEYS.expenses).filter((expense) => expense.tripId !== id));
}
