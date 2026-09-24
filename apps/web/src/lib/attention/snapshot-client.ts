"use client";

// Loads Family State for the attention engine in the browser (Supabase APIs when configured, else demo storage).
import { cloudEnabled, loadCloudConversations, loadCloudProfile } from "@/lib/experience/cloud";
import { getConversations, getProfile } from "@/lib/experience/storage";
import { loadMoney } from "@/lib/money/client";
import { monthKey, summarizeMonth } from "@/lib/money/summary";
import type { MoneyBundle } from "@/lib/money/types";
import { loadShopping } from "@/lib/shopping/item-client";
import { estimateItems, itemRateResolver } from "@/lib/shopping/items";
import { shiftMonth } from "@/lib/shopping/plan";
import type { ShoppingState } from "@/lib/shopping/state";
import type { FamilySnapshot } from "./engine";

export interface LoadedState { snapshot: FamilySnapshot; shopping: ShoppingState; bundle: MoneyBundle | null }

const EMPTY_SHOPPING: ShoppingState = { items: [], purchases: [], checks: [], plan: [], dismissed: [] };

export async function loadSnapshot(displayName?: string, now = new Date()): Promise<LoadedState> {
  const [profile, conversations] = cloudEnabled ? await Promise.all([loadCloudProfile(), loadCloudConversations()]) : [getProfile(), getConversations()];
  const month = monthKey(now);
  // Money and Shopping are optional (not signed in, not set up yet): the engine works with what it gets.
  const [bundle, previous, shopping] = await Promise.all([
    loadMoney(month).catch(() => null),
    loadMoney(shiftMonth(month, -1)).catch(() => null),
    loadShopping().catch(() => EMPTY_SHOPPING),
  ]);
  const estimates = estimateItems(shopping.items, shopping.purchases, itemRateResolver(profile, now), now, shopping.checks);
  const snapshot: FamilySnapshot = {
    profile, displayName, conversations,
    month: bundle ? summarizeMonth(bundle) : null,
    history: [...(bundle?.transactions ?? []), ...(previous?.transactions ?? [])],
    goals: bundle?.goals ?? [],
    estimates, plan: shopping.plan,
    counts: { transactions: (bundle?.transactions.length ?? 0) + (previous?.transactions.length ?? 0), items: shopping.items.length },
  };
  return { snapshot, shopping, bundle };
}
