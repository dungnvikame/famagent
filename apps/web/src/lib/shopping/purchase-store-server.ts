// Supabase side of PURCHASE_COMPLETED (migrations 202609240008, 202609240012): purchase row + ledger expense + event log.
import type { SupabaseClient } from "@supabase/supabase-js";
import { transactionRow } from "../money/store-server.ts";
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

/**
 * Records the purchase, its ledger expense (Finance) and the event; returns the stored purchase or an error code.
 * With `linkTransactionId` the expense already exists in the ledger (typed there first): it is linked, not duplicated.
 */
export async function recordPurchase(client: SupabaseClient, userId: string, purchase: Purchase, forChild: boolean, linkTransactionId?: string): Promise<Purchase | "transaction" | "purchase" | "linked"> {
  let transactionId: string;
  if (linkTransactionId) {
    const { data: row } = await client.from("money_transactions").select("id,kind").eq("id", linkTransactionId).eq("user_id", userId).maybeSingle();
    const { data: taken } = await client.from("purchases").select("id").eq("user_id", userId).eq("transaction_id", linkTransactionId).limit(1);
    if (!row || row.kind !== "expense" || taken?.length) return "linked";
    transactionId = linkTransactionId;
  } else {
    const transaction = transactionForPurchase(purchase, forChild, crypto.randomUUID());
    const { error: txError } = await client.from("money_transactions").insert(transactionRow(transaction, userId));
    if (txError) return "transaction";
    transactionId = transaction.id;
  }
  const stored = { ...purchase, transactionId };
  const { error } = await client.from("purchases").insert(purchaseRow(stored, userId));
  if (error) { if (!linkTransactionId) await client.from("money_transactions").delete().eq("id", transactionId); return "purchase"; }
  // Event log is observability + replay; a failed insert never fails the user's action.
  const { error: eventError } = await client.from("family_events").insert({ user_id: userId, type: "PURCHASE_COMPLETED", payload: { purchaseId: stored.id, itemId: stored.itemId, productId: stored.productId ?? null, amount: stored.amount, unitCount: stored.unitCount, transactionId, source: stored.source ?? "catalog" } });
  if (eventError) console.warn("[family_events]", JSON.stringify({ code: eventError.code ?? "unknown" }));
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
