// Supabase side of household items (migration 202609240012). RLS scopes every row to the user; queries still filter by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingItem } from "./items.ts";
import { validItem } from "./item-validate.ts";
import { loadPurchases } from "./purchase-store-server.ts";
import type { ShoppingState } from "./state.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" && value ? value : undefined;
const num = (value: unknown) => value === null || value === undefined ? undefined : Number(value);

export const itemFromRow = (row: Row): ShoppingItem => ({ id: row.id as string, name: row.name as string, category: row.category as ShoppingItem["category"], unit: row.unit as string, packSize: num(row.pack_size), brand: str(row.brand), merchant: str(row.merchant), dailyRate: num(row.daily_rate), childId: str(row.child_id), productId: str(row.product_id), status: row.status as ShoppingItem["status"] });
export const itemRow = (item: ShoppingItem, userId: string) => ({ id: item.id, user_id: userId, name: item.name, category: item.category, unit: item.unit, pack_size: item.packSize ?? null, brand: item.brand ?? null, merchant: item.merchant ?? null, daily_rate: item.dailyRate ?? null, child_id: item.childId ?? null, product_id: item.productId ?? null, status: item.status, updated_at: new Date().toISOString() });

export async function loadItems(client: SupabaseClient, userId: string): Promise<ShoppingItem[] | null> {
  const { data, error } = await client.from("shopping_items").select("*").eq("user_id", userId).order("created_at").limit(300);
  return error ? null : (data ?? []).map(itemFromRow);
}

export async function saveItem(client: SupabaseClient, userId: string, item: ShoppingItem): Promise<boolean> {
  const { error } = await client.from("shopping_items").upsert(itemRow(item, userId), { onConflict: "id" });
  return !error;
}

/** Upsertable resources of /api/shopping/[resource]: validator, row mapper, conflict target, id column for DELETE. */
export const SHOPPING_RESOURCES = {
  items: { table: "shopping_items", validate: validItem, row: itemRow as (item: never, userId: string) => object, conflict: "id", idColumn: "id" },
} as const;
export type ShoppingResource = keyof typeof SHOPPING_RESOURCES;

export async function loadShoppingState(client: SupabaseClient, userId: string): Promise<ShoppingState | null> {
  const [items, purchases] = await Promise.all([loadItems(client, userId), loadPurchases(client, userId)]);
  return items && purchases ? { items, purchases } : null;
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
