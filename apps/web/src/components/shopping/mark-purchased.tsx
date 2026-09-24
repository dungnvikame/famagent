"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { vnd } from "@/lib/catalog/format";
import { cloudEnabled, loadCloudProfile } from "@/lib/experience/cloud";
import { getProfile } from "@/lib/experience/storage";
import type { ChildProfile } from "@/lib/experience/types";
import { todayLocal } from "@/lib/money/parse";
import type { PurchaseDraft } from "@/lib/shopping/capture";
import { loadShopping } from "@/lib/shopping/item-client";
import type { ShoppingItem } from "@/lib/shopping/items";
import type { Purchase, PurchaseSource } from "@/lib/shopping/purchases";
import { PurchaseDraftCard } from "./purchase-draft-card";

export interface PurchaseTarget { productId?: string; productName: string; brand?: string; variantId?: string; offerId?: string; merchant?: string; price?: number; piecesPerPack?: number; childId?: string; itemId?: string }

/**
 * "Đã mua" → PURCHASE_COMPLETED (SPEC_V2 §30) from a product page, a recommendation or a household item: opens the
 * shared confirmation card prefilled from the target; the purchase restocks the matching item (or creates it).
 */
export function MarkPurchased({ target, compact = false, source = "catalog", label = "Đã mua", onDone }: { target: PurchaseTarget; compact?: boolean; source?: PurchaseSource; label?: string; onDone?: (purchase: Purchase) => void }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<{ items: ShoppingItem[]; children: ChildProfile[] } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Purchase | null>(null);

  async function show() {
    setOpen(true); setError("");
    try {
      const [state, profile] = await Promise.all([loadShopping(), cloudEnabled ? loadCloudProfile() : Promise.resolve(getProfile())]);
      setContext({ items: state.items, children: profile?.children ?? [] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải danh sách món."); }
  }

  if (done) return <span className="purchased-done" role="status">✓ Đã ghi {vnd(done.amount)} vào Tiền · theo dõi {done.unitCount} {context?.items.find((item) => item.id === done.itemId)?.unit ?? "đơn vị"}</span>;
  const match = context?.items.find((item) => item.id === target.itemId) ?? context?.items.find((item) => target.productId && item.productId === target.productId);
  const draft: PurchaseDraft = { itemId: match?.id, name: match?.name ?? target.productName, category: match?.category ?? "diapers", unit: match?.unit ?? "miếng", packs: 1, packSize: match?.packSize ?? target.piecesPerPack, brand: target.brand, amount: target.price, merchant: target.merchant ?? match?.merchant, purchasedOn: todayLocal(), missing: [] };
  return <span className="mark-purchased">
    <button type="button" className={compact ? "ledger-link" : "app-btn ghost"} onClick={() => open ? setOpen(false) : void show()} aria-expanded={open}>{label}</button>
    {open && createPortal(<>
      <button type="button" className="purchase-backdrop" aria-label="Đóng" onClick={() => setOpen(false)} />
      <div className="purchase-form" role="dialog" aria-modal="true" aria-label={`Ghi lần mua ${target.productName}`}>
        {error ? <p className="form-error" role="alert">{error}</p> : !context ? <p className="app-sub" aria-busy="true">Đang tải…</p>
          : <PurchaseDraftCard draft={draft} items={context.items} familyChildren={context.children} source={source} catalog={target.productId ? { productId: target.productId, variantId: target.variantId, offerId: target.offerId, brand: target.brand } : undefined} title={target.productName} onCancel={() => setOpen(false)} onSaved={(purchase) => { setDone(purchase); setOpen(false); onDone?.(purchase); }} />}
      </div></>, document.body)}
  </span>;
}
