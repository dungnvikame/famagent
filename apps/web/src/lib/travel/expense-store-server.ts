// Server side of a trip expense (plan 261010-1335 acceptance #4): one travel_expenses row + one mirrored ledger
// expense (category "Du lịch", source "trip"), same safety as lib/shopping/purchase-store-server.ts recordPurchase:
// the ledger id derives from the expense id (a retry can never add a second expense) and a failed insert undoes
// the ledger row it created.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { transactionRow } from "../money/store-server.ts";
import type { MoneyTransaction } from "../money/types.ts";
import { expenseFromRow, expenseRow } from "./store-server.ts";
import type { TripExpense } from "./types.ts";

export const TRIP_LEDGER_CATEGORY = "Du lịch";

/** Deterministic UUID (v5-style layout) of the ledger row that belongs to this trip expense. */
export function ledgerIdForTripExpense(expenseId: string): string {
  const hex = createHash("sha256").update(`trip-ledger:${expenseId.toLowerCase()}`).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function transactionForTripExpense(expense: TripExpense, tripName: string): MoneyTransaction {
  return { id: ledgerIdForTripExpense(expense.id), occurredOn: expense.occurredOn, content: expense.content, category: TRIP_LEDGER_CATEGORY, kind: "expense", amount: expense.amount, forChild: false, note: tripName ? `Chuyến ${tripName}` : undefined, source: "trip" };
}

async function storedExpense(client: SupabaseClient, userId: string, id: string): Promise<TripExpense | null> {
  const { data } = await client.from("travel_expenses").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? expenseFromRow(data) : null;
}

/** Observability only — a failed event write never fails the expense. */
async function logRecorded(client: SupabaseClient, userId: string, expense: TripExpense): Promise<void> {
  const { error } = await client.from("family_events").insert({ user_id: userId, type: "TRIP_EXPENSE_RECORDED", payload: { expenseId: expense.id, tripId: expense.tripId, bucket: expense.bucket, amount: expense.amount, transactionId: expense.transactionId } });
  if (error) console.warn("[family_events]", JSON.stringify({ code: error.code ?? "unknown" }));
}

/**
 * Upserts the expense and keeps its ledger mirror in sync. New expense: write the ledger row first (on conflict
 * do nothing — an earlier attempt's row is reused), then the expense; a failed expense insert removes the ledger
 * row it created. Edited expense: both rows are updated in place under the same ids.
 */
export async function recordTripExpense(client: SupabaseClient, userId: string, expense: TripExpense, tripName: string): Promise<TripExpense | "transaction" | "expense"> {
  const existing = await storedExpense(client, userId, expense.id);
  const transaction = transactionForTripExpense(expense, tripName);
  const stored: TripExpense = { ...expense, transactionId: transaction.id };
  if (existing) {
    // An edit: refresh both rows (the mirror upsert also heals a mirror that a past failure left missing).
    const { error: txError } = await client.from("money_transactions").upsert(transactionRow(transaction, userId), { onConflict: "id" });
    if (txError) return "transaction";
    const { error } = await client.from("travel_expenses").upsert(expenseRow(stored, userId), { onConflict: "id" });
    return error ? "expense" : stored;
  }
  const { error: txError } = await client.from("money_transactions").upsert(transactionRow(transaction, userId), { onConflict: "id", ignoreDuplicates: true });
  if (txError) return "transaction";
  const { error } = await client.from("travel_expenses").insert(expenseRow(stored, userId));
  if (error) {
    // A concurrent request with the same expense id won: its rows stand, nothing to undo.
    const winner = await storedExpense(client, userId, expense.id);
    if (winner) return winner;
    const { error: undoError } = await client.from("money_transactions").delete().eq("id", transaction.id).eq("user_id", userId).eq("source", "trip");
    if (undoError) console.warn("[trip-expense]", JSON.stringify({ step: "undo_expense", code: undoError.code ?? "unknown" }));
    return "expense";
  }
  await logRecorded(client, userId, stored);
  return stored;
}

/** Removing a trip expense also removes the ledger row it created. */
export async function deleteTripExpense(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data } = await client.from("travel_expenses").select("transaction_id").eq("id", id).eq("user_id", userId).maybeSingle();
  const { error } = await client.from("travel_expenses").delete().eq("id", id).eq("user_id", userId);
  if (error) return false;
  if (data?.transaction_id) await client.from("money_transactions").delete().eq("id", data.transaction_id).eq("user_id", userId).eq("source", "trip");
  return true;
}
