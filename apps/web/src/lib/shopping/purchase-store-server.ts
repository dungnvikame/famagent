// Supabase side of PURCHASE_COMPLETED (migration 202609240008): purchase row + ledger expense + event log.
import type { SupabaseClient } from "@supabase/supabase-js";
import { transactionRow } from "../money/store-server.ts";
import { transactionForPurchase, type Purchase } from "./purchases.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : undefined;
const num = (value: unknown) => typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

export const purchaseFromRow = (row: Row): Purchase => ({ id: row.id as string, productId: row.product_id as string, productName: row.product_name as string, brand: str(row.brand), variantId: str(row.variant_id), offerId: str(row.offer_id), merchant: str(row.merchant), amount: num(row.amount), packs: num(row.packs) || 1, unitCount: num(row.unit_count), purchasedOn: row.purchased_on as string, childId: str(row.child_id), dailyRate: row.daily_rate === null || row.daily_rate === undefined ? undefined : num(row.daily_rate), transactionId: str(row.transaction_id) });
const purchaseRow = (item: Purchase, userId: string) => ({ id: item.id, user_id: userId, product_id: item.productId, product_name: item.productName, brand: item.brand ?? null, variant_id: item.variantId ?? null, offer_id: item.offerId ?? null, merchant: item.merchant ?? null, amount: item.amount, packs: item.packs, unit_count: item.unitCount, purchased_on: item.purchasedOn, child_id: item.childId ?? null, daily_rate: item.dailyRate ?? null, transaction_id: item.transactionId ?? null });

export async function loadPurchases(client: SupabaseClient, userId: string): Promise<Purchase[] | null> {
  const { data, error } = await client.from("purchases").select("*").eq("user_id", userId).order("purchased_on", { ascending: false }).limit(500);
  return error ? null : (data ?? []).map(purchaseFromRow);
}

/** Records the purchase, its ledger expense (Finance) and the event; returns the stored purchase or an error code. */
export async function recordPurchase(client: SupabaseClient, userId: string, purchase: Purchase, forChild: boolean): Promise<Purchase | "transaction" | "purchase"> {
  const transaction = transactionForPurchase(purchase, forChild, crypto.randomUUID());
  const { error: txError } = await client.from("money_transactions").insert(transactionRow(transaction, userId));
  if (txError) return "transaction";
  const stored = { ...purchase, transactionId: transaction.id };
  const { error } = await client.from("purchases").insert(purchaseRow(stored, userId));
  if (error) { await client.from("money_transactions").delete().eq("id", transaction.id); return "purchase"; }
  // Event log is observability + replay; a failed insert never fails the user's action.
  const { error: eventError } = await client.from("family_events").insert({ user_id: userId, type: "PURCHASE_COMPLETED", payload: { purchaseId: stored.id, productId: stored.productId, amount: stored.amount, unitCount: stored.unitCount, transactionId: transaction.id } });
  if (eventError) console.warn("[family_events]", JSON.stringify({ code: eventError.code ?? "unknown" }));
  return stored;
}

/** Updates the per-product daily rate (consumption side) on the latest purchase row. */
export async function updatePurchaseRate(client: SupabaseClient, userId: string, id: string, dailyRate: number | null): Promise<boolean> {
  const { error } = await client.from("purchases").update({ daily_rate: dailyRate }).eq("id", id).eq("user_id", userId);
  return !error;
}

/** Removing a purchase also removes the ledger entry it created (the event stays, marked removed). */
export async function deletePurchase(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data } = await client.from("purchases").select("transaction_id").eq("id", id).eq("user_id", userId).maybeSingle();
  const { error } = await client.from("purchases").delete().eq("id", id).eq("user_id", userId);
  if (error) return false;
  if (data?.transaction_id) await client.from("money_transactions").delete().eq("id", data.transaction_id).eq("user_id", userId);
  await client.from("family_events").insert({ user_id: userId, type: "PURCHASE_REMOVED", payload: { purchaseId: id } });
  return true;
}
