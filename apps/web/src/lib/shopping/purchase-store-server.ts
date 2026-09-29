// Supabase side of PURCHASE_COMPLETED (migrations 202609240008, 202609240012): purchase row + ledger expense + event log.
import type { SupabaseClient } from "@supabase/supabase-js";
import { transactionRow } from "../money/store-server.ts";
import { ledgerIdForPurchase } from "./purchase-idempotency.ts";
import { transactionForPurchase, type Purchase, type PurchaseSource } from "./purchases.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : undefined;
const num = (value: unknown) => typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

export const purchaseFromRow = (row: Row): Purchase => ({ id: row.id as string, itemId: str(row.item_id), productId: str(row.product_id), productName: row.product_name as string, brand: str(row.brand), variantId: str(row.variant_id), offerId: str(row.offer_id), merchant: str(row.merchant), amount: num(row.amount), packs: num(row.packs) || 1, unitCount: num(row.unit_count), purchasedOn: row.purchased_on as string, childId: str(row.child_id), dailyRate: row.daily_rate === null || row.daily_rate === undefined ? undefined : num(row.daily_rate), transactionId: str(row.transaction_id), source: (str(row.source) ?? "catalog") as PurchaseSource });
const purchaseRow = (item: Purchase, userId: string) => ({ id: item.id, user_id: userId, item_id: item.itemId, product_id: item.productId ?? null, product_name: item.productName, brand: item.brand ?? null, variant_id: item.variantId ?? null, offer_id: item.offerId ?? null, merchant: item.merchant ?? null, amount: item.amount, packs: item.packs, unit_count: item.unitCount, purchased_on: item.purchasedOn, child_id: item.childId ?? null, transaction_id: item.transactionId ?? null, source: item.source ?? "catalog" });

export async function loadPurchases(client: SupabaseClient, userId: string): Promise<Purchase[] | null> {
  const { data, error } = await client.from("purchases").select("*").eq("user_id", userId).order("purchased_on", { ascending: false }).limit(1000);
  return error ? null : (data ?? []).map(purchaseFromRow);
}

/** The purchase already stored under this id (a retry, or the winner of a double submit), if any. */
async function storedPurchase(client: SupabaseClient, userId: string, id: string): Promise<Purchase | null> {
  const { data } = await client.from("purchases").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? purchaseFromRow(data) : null;
}

/**
 * PURCHASE_COMPLETED is logged once per purchase id (also on a retry whose first attempt lost the event).
 * The log is observability + replay; a failed write never fails the user's action.
 */
async function logCompleted(client: SupabaseClient, userId: string, stored: Purchase): Promise<void> {
  const { data: seen } = await client.from("family_events").select("id").eq("user_id", userId).eq("type", "PURCHASE_COMPLETED").eq("payload->>purchaseId", stored.id).limit(1);
  if (seen?.length) return;
  const { error } = await client.from("family_events").insert({ user_id: userId, type: "PURCHASE_COMPLETED", payload: { purchaseId: stored.id, itemId: stored.itemId, productId: stored.productId ?? null, amount: stored.amount, unitCount: stored.unitCount, transactionId: stored.transactionId, source: stored.source ?? "catalog" } });
  // 23505: a concurrent request logged the same purchase first (unique index from migration 202609290019).
  if (error && error.code !== "23505") console.warn("[family_events]", JSON.stringify({ code: error.code ?? "unknown" }));
}

/**
 * Records the purchase, its ledger expense (Finance) and the event; returns the stored purchase or an error code.
 * Safe to retry with the same purchase id: an existing purchase is returned as is, the ledger row id is derived
 * from the purchase id (never a second expense) and a failed purchase insert removes the expense it created.
 * With `linkTransactionId` the expense already exists in the ledger (typed there first): it is linked, not duplicated.
 */
export async function recordPurchase(client: SupabaseClient, userId: string, purchase: Purchase, forChild: boolean, linkTransactionId?: string): Promise<Purchase | "transaction" | "purchase" | "linked"> {
  const replay = await storedPurchase(client, userId, purchase.id);
  if (replay) { await logCompleted(client, userId, replay); return replay; }
  let transactionId: string;
  let createdExpense = false;
  if (linkTransactionId) {
    const { data: row } = await client.from("money_transactions").select("id,kind").eq("id", linkTransactionId).eq("user_id", userId).maybeSingle();
    const { data: taken } = await client.from("purchases").select("id").eq("user_id", userId).eq("transaction_id", linkTransactionId).limit(1);
    if (!row || row.kind !== "expense" || taken?.length) return "linked";
    transactionId = linkTransactionId;
  } else {
    const transaction = transactionForPurchase(purchase, forChild, ledgerIdForPurchase(purchase.id));
    // On conflict do nothing: an expense left by an earlier attempt of this same purchase is reused.
    const { error: txError } = await client.from("money_transactions").upsert(transactionRow(transaction, userId), { onConflict: "id", ignoreDuplicates: true });
    if (txError) return "transaction";
    transactionId = transaction.id;
    createdExpense = true;
  }
  const stored = { ...purchase, transactionId };
  const { error } = await client.from("purchases").insert(purchaseRow(stored, userId));
  if (error) {
    // A concurrent request with the same purchase id won: its rows stand, nothing to undo.
    const winner = await storedPurchase(client, userId, purchase.id);
    if (winner) { await logCompleted(client, userId, winner); return winner; }
    if (createdExpense) {
      const { error: undoError } = await client.from("money_transactions").delete().eq("id", transactionId).eq("user_id", userId);
      if (undoError) console.warn("[purchase]", JSON.stringify({ step: "undo_expense", code: undoError.code ?? "unknown" }));
    }
    return error.code === "23505" && linkTransactionId ? "linked" : "purchase";
  }
  await logCompleted(client, userId, stored);
  return stored;
}

/** Removing a purchase also removes the ledger entry it created; a linked ledger row (source "ledger") stays. */
export async function deletePurchase(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data } = await client.from("purchases").select("transaction_id,source").eq("id", id).eq("user_id", userId).maybeSingle();
  const { error } = await client.from("purchases").delete().eq("id", id).eq("user_id", userId);
  if (error) return false;
  if (data?.transaction_id && data.source !== "ledger") await client.from("money_transactions").delete().eq("id", data.transaction_id).eq("user_id", userId);
  await client.from("family_events").insert({ user_id: userId, type: "PURCHASE_REMOVED", payload: { purchaseId: id } });
  return true;
}
