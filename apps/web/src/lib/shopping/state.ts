// Everything the Shopping page reads in one request (GET /api/shopping, or the browser store in demo mode).
import type { ShoppingItem, StockCheck } from "./items.ts";
import type { PlanEntry } from "./plan.ts";
import type { Purchase } from "./purchases.ts";

export interface ShoppingState {
  items: ShoppingItem[];
  purchases: Purchase[];
  checks: StockCheck[];
  plan: PlanEntry[];
  /** Ledger transaction ids the family said are not household shopping. */
  dismissed: string[];
}
