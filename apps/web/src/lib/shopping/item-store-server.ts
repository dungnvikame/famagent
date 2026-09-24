// Supabase side of Shopping (migrations 202609240012–13): household items, stock checks, the monthly plan and
// dismissed ledger rows. RLS scopes every row to the user; queries still filter by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingItem, StockCheck } from "./items.ts";
import { validCheck, validDismissed, validItem, validPlanEntry } from "./item-validate.ts";
import type { PlanEntry } from "./plan.ts";
import { loadPurchases } from "./purchase-store-server.ts";
import type { ShoppingState } from "./state.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" && value ? value : undefined;
const num = (value: unknown) => value === null || value === undefined ? undefined : Number(value);

export const itemFromRow = (row: Row): ShoppingItem => ({ id: row.id as string, name: row.name as string, category: row.category as ShoppingItem["category"], unit: row.unit as string, packSize: num(row.pack_size), brand: str(row.brand), merchant: str(row.merchant), dailyRate: num(row.daily_rate), childId: str(row.child_id), productId: str(row.product_id), status: row.status as ShoppingItem["status"] });
export const itemRow = (item: ShoppingItem, userId: string) => ({ id: item.id, user_id: userId, name: item.name, category: item.category, unit: item.unit, pack_size: item.packSize ?? null, brand: item.brand ?? null, merchant: item.merchant ?? null, daily_rate: item.dailyRate ?? null, child_id: item.childId ?? null, product_id: item.productId ?? null, status: item.status, updated_at: new Date().toISOString() });
const checkFromRow = (row: Row): StockCheck => ({ id: row.id as string, itemId: row.item_id as string, checkedOn: row.checked_on as string, remaining: Number(row.remaining) });
const checkRow = (check: StockCheck, userId: string) => ({ id: check.id, user_id: userId, item_id: check.itemId, checked_on: check.checkedOn, remaining: check.remaining });
const planFromRow = (row: Row): PlanEntry => ({ id: row.id as string, month: row.month as string, itemId: str(row.item_id), stageKey: str(row.stage_key), name: row.name as string, packs: Number(row.packs) || 1, estAmount: num(row.est_amount), reason: row.reason as PlanEntry["reason"], status: row.status as PlanEntry["status"] });
const planRow = (entry: PlanEntry, userId: string) => ({ id: entry.id, user_id: userId, month: entry.month, item_id: entry.itemId ?? null, stage_key: entry.stageKey ?? null, name: entry.name, packs: entry.packs, est_amount: entry.estAmount ?? null, reason: entry.reason, status: entry.status });
const dismissedRow = (item: { transactionId: string }, userId: string) => ({ user_id: userId, transaction_id: item.transactionId });

/** Upsertable resources of /api/shopping/[resource]: validator, row mapper, conflict target, id column for DELETE. */
type Handler = { table: string; validate: (input: unknown) => object | null; row: (item: never, userId: string) => object; conflict: string; idColumn: string };
export const SHOPPING_RESOURCES = {
  items: { table: "shopping_items", validate: validItem, row: itemRow as Handler["row"], conflict: "id", idColumn: "id" },
  checks: { table: "stock_checks", validate: validCheck, row: checkRow as Handler["row"], conflict: "id", idColumn: "id" },
  plan: { table: "shopping_plan_entries", validate: validPlanEntry, row: planRow as Handler["row"], conflict: "id", idColumn: "id" },
  dismissed: { table: "shopping_tx_dismissed", validate: validDismissed, row: dismissedRow as Handler["row"], conflict: "user_id,transaction_id", idColumn: "transaction_id" },
} satisfies Record<string, Handler>;
export type ShoppingResource = keyof typeof SHOPPING_RESOURCES;

export async function loadItems(client: SupabaseClient, userId: string): Promise<ShoppingItem[] | null> {
  const { data, error } = await client.from("shopping_items").select("*").eq("user_id", userId).order("created_at").limit(300);
  return error ? null : (data ?? []).map(itemFromRow);
}

export async function saveItem(client: SupabaseClient, userId: string, item: ShoppingItem): Promise<boolean> {
  const { error } = await client.from("shopping_items").upsert(itemRow(item, userId), { onConflict: "id" });
  return !error;
}

export async function loadShoppingState(client: SupabaseClient, userId: string): Promise<ShoppingState | null> {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const [items, purchases, checks, plan, dismissed] = await Promise.all([
    loadItems(client, userId), loadPurchases(client, userId),
    client.from("stock_checks").select("*").eq("user_id", userId).gte("checked_on", since).order("checked_on").limit(1000),
    client.from("shopping_plan_entries").select("*").eq("user_id", userId).order("created_at").limit(500),
    client.from("shopping_tx_dismissed").select("transaction_id").eq("user_id", userId).limit(2000),
  ]);
  if (!items || !purchases || checks.error || plan.error || dismissed.error) return null;
  return { items, purchases, checks: (checks.data ?? []).map(checkFromRow), plan: (plan.data ?? []).map(planFromRow), dismissed: (dismissed.data ?? []).map((row) => row.transaction_id as string) };
}

/** Deleting an item removes its purchases (FK cascade) and the ledger entries they created. */
export async function deleteItem(client: SupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data: all } = await client.from("purchases").select("transaction_id,source").eq("user_id", userId).eq("item_id", id);
  const { error } = await client.from("shopping_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return false;
  // Purchases linked to an existing ledger row (source "ledger") keep that row: the family typed it in the ledger first.
  const created = (all ?? []).filter((row) => row.source !== "ledger").map((row) => row.transaction_id).filter(Boolean);
  if (created.length) await client.from("money_transactions").delete().eq("user_id", userId).in("id", created);
  return true;
}
