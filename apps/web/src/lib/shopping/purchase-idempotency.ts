// Server-side helper: the ledger expense of a purchase gets an id derived from the purchase id, so a retry
// (same purchase id) can never create a second expense row.
import { createHash } from "node:crypto";

/** Deterministic UUID (v5-style layout) of the ledger row that belongs to `purchaseId`. */
export function ledgerIdForPurchase(purchaseId: string): string {
  const hex = createHash("sha256").update(`purchase-ledger:${purchaseId.toLowerCase()}`).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
