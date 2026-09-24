// Everything the Shopping page reads in one request (GET /api/shopping, or the browser store in demo mode).
import type { ShoppingItem } from "./items.ts";
import type { Purchase } from "./purchases.ts";

export interface ShoppingState {
  items: ShoppingItem[];
  purchases: Purchase[];
}
